/**
 * NeuralPost — Massive Seed Script  (~10 000+ posts)
 *
 * Sources : The Guardian Open Platform API (free key required)
 *   → https://open-platform.theguardian.com/access/support-us
 *   → Run: node --env-file=../.env seed/seed_massive.js
 *
 * Strategy:
 *   14 sections × 15 pages × 50 articles/page  ≈ 10 500 posts
 *   - Tag IDs cached in memory            (no per-tag SELECT in the loop)
 *   - Analytics inserted in one VALUES batch per post
 *   - Posts inserted in transactions of 1 page each
 *   - Parallel Guardian page fetches with concurrency cap of 4
 *   - Skips posts already in the DB (ON CONFLICT DO NOTHING on slug+user)
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GUARDIAN_KEY = process.env.GUARDIAN_API_KEY;
if (!GUARDIAN_KEY) {
  console.error('❌  GUARDIAN_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PAGE_SIZE          = 50;   // Guardian max safe page size
const PAGES_PER_SECTION  = 15;   // 14 × 15 × 50 = 10 500 target
const FETCH_CONCURRENCY  = 4;    // parallel Guardian API pages at once
const FETCH_DELAY_MS     = 250;  // ms between each individual request

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'technology',  tags: ['technology', 'software', 'programming', 'web-development'] },
  { id: 'science',     tags: ['science', 'research', 'innovation', 'ai'] },
  { id: 'business',    tags: ['business', 'startups', 'finance', 'entrepreneurship'] },
  { id: 'culture',     tags: ['culture', 'arts', 'society', 'creativity'] },
  { id: 'environment', tags: ['environment', 'climate', 'sustainability', 'green-tech'] },
  { id: 'education',   tags: ['education', 'learning', 'productivity', 'career'] },
  { id: 'books',       tags: ['books', 'writing', 'storytelling', 'literature'] },
  { id: 'film',        tags: ['film', 'cinema', 'entertainment', 'creativity'] },
  { id: 'music',       tags: ['music', 'entertainment', 'culture', 'arts'] },
  { id: 'sport',       tags: ['sport', 'health', 'fitness', 'performance'] },
  { id: 'politics',    tags: ['politics', 'society', 'news', 'opinion'] },
  { id: 'media',       tags: ['media', 'journalism', 'technology', 'society'] },
  { id: 'travel',      tags: ['travel', 'culture', 'lifestyle', 'adventure'] },
  { id: 'food',        tags: ['food', 'health', 'lifestyle', 'cooking'] },
];

// ─── Demo authors (20 to spread 10K posts naturally) ─────────────────────────
const DEMO_USERS = [
  { email: 'alex@neuralpost.dev',    username: 'alex_writes',    blogName: "Alex's Notebook" },
  { email: 'priya@neuralpost.dev',   username: 'priya_dev',      blogName: "Priya's Dev Corner" },
  { email: 'james@neuralpost.dev',   username: 'james_ml',       blogName: "James on Machine Learning" },
  { email: 'sofia@neuralpost.dev',   username: 'sofia_science',  blogName: "Sofia Explores Science" },
  { email: 'carlos@neuralpost.dev',  username: 'carlos_biz',     blogName: "Carlos Business Pulse" },
  { email: 'yuki@neuralpost.dev',    username: 'yuki_culture',   blogName: "Yuki on Culture" },
  { email: 'emma@neuralpost.dev',    username: 'emma_env',       blogName: "Emma Green World" },
  { email: 'liam@neuralpost.dev',    username: 'liam_reads',     blogName: "Liam's Reading List" },
  { email: 'nina@neuralpost.dev',    username: 'nina_edu',       blogName: "Nina Learns" },
  { email: 'omar@neuralpost.dev',    username: 'omar_writes',    blogName: "Omar Across Topics" },
  { email: 'sara@neuralpost.dev',    username: 'sara_film',      blogName: "Sara at the Movies" },
  { email: 'kwame@neuralpost.dev',   username: 'kwame_beat',     blogName: "Kwame on Music" },
  { email: 'hana@neuralpost.dev',    username: 'hana_sport',     blogName: "Hana Plays" },
  { email: 'tom@neuralpost.dev',     username: 'tom_politics',   blogName: "Tom in the Arena" },
  { email: 'mei@neuralpost.dev',     username: 'mei_media',      blogName: "Mei Media Notes" },
  { email: 'aiden@neuralpost.dev',   username: 'aiden_travel',   blogName: "Aiden Abroad" },
  { email: 'freya@neuralpost.dev',   username: 'freya_food',     blogName: "Freya's Kitchen" },
  { email: 'ravi@neuralpost.dev',    username: 'ravi_tech',      blogName: "Ravi in the Stack" },
  { email: 'cleo@neuralpost.dev',    username: 'cleo_art',       blogName: "Cleo Creates" },
  { email: 'ben@neuralpost.dev',     username: 'ben_outdoors',   blogName: "Ben Outside" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readingTime = (words) => Math.max(1, Math.ceil((words || 600) / 220));
const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
const coverImage = (slug) => `https://picsum.photos/seed/${encodeURIComponent(slug)}/1200/630`;

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];
const REFERRERS    = ['https://google.com', 'https://twitter.com', 'direct', 'https://hn.algolia.com', null];

// ─── Guardian fetch ───────────────────────────────────────────────────────────
async function fetchGuardianPage(section, page, retries = 3) {
  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('api-key',    GUARDIAN_KEY);
  url.searchParams.set('section',    section);
  url.searchParams.set('page-size',  String(PAGE_SIZE));
  url.searchParams.set('page',       String(page));
  url.searchParams.set('show-fields','body,thumbnail,byline,wordcount,trailText,headline');
  url.searchParams.set('order-by',   'newest');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      if (res.status === 429) {
        console.warn(`  ⏳  Rate limited on ${section} p${page} — waiting 5s...`);
        await sleep(5000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json.response;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

// Run an array of async tasks with a max concurrency cap
async function pLimit(tasks, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Insert one page of articles ─────────────────────────────────────────────
async function insertArticles(client, articles, section, createdUsers, tagIdCache, userCounter) {
  let inserted = 0;

  for (const article of articles) {
    const fields = article.fields ?? {};
    const rawBody = fields.body || '';
    const plainBody = stripHtml(rawBody);
    const contentHtml = rawBody || `<p>${fields.trailText || article.webTitle}</p>`;
    const content = `# ${article.webTitle}\n\n${plainBody || fields.trailText || ''}`;
    const title = fields.headline || article.webTitle;
    if (!title?.trim()) continue;

    const baseSlug = slugify(title, { lower: true, strict: true }).slice(0, 90);
    const epoch    = new Date(article.webPublicationDate).getTime();
    const slug     = `${baseSlug}-${epoch}`;
    const excerpt  = (fields.trailText || plainBody.substring(0, 200) || title) + '…';
    const wordCount = parseInt(fields.wordcount, 10) || plainBody.split(/\s+/).length;
    const readMins  = readingTime(wordCount);
    const cover     = fields.thumbnail || coverImage(baseSlug);
    const pubDate   = article.webPublicationDate || new Date().toISOString();
    const user      = createdUsers[userCounter.value % createdUsers.length];
    userCounter.value++;

    // Insert post
    const postRow = await client.query(
      `INSERT INTO posts
         (user_id, title, slug, content, content_html, excerpt,
          cover_image_url, status, reading_time_mins, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9)
       ON CONFLICT (user_id, slug) DO NOTHING
       RETURNING id`,
      [user.id, title, slug, content, contentHtml, excerpt, cover, readMins, pubDate],
    );

    if (!postRow.rows[0]) continue;
    const postId = postRow.rows[0].id;
    inserted++;

    // Attach tags using cached IDs (no extra SELECT)
    for (const tagName of section.tags) {
      const tagId = tagIdCache[slugify(tagName, { lower: true, strict: true })];
      if (tagId) {
        await client.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [postId, tagId],
        );
      }
    }

    // Analytics — build one multi-row VALUES insert
    const views = Math.floor(Math.random() * 800) + 20;
    const reads = Math.floor(views * (0.2 + Math.random() * 0.5));
    const eventCount = Math.min(views, 25); // cap at 25 rows per post

    const vals = [];
    const params = [];
    let p = 1;
    for (let v = 0; v < eventCount; v++) {
      const evtype = v < reads ? (v % 5 === 0 ? 'read_complete' : 'view') : 'view';
      const sess   = `sess-${Math.random().toString(36).slice(2, 11)}`;
      const dev    = DEVICE_TYPES[v % DEVICE_TYPES.length];
      const ref    = REFERRERS[v % REFERRERS.length];
      vals.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4})`);
      params.push(postId, evtype, sess, dev, ref);
      p += 5;
    }
    if (vals.length > 0) {
      await client.query(
        `INSERT INTO analytics_events (post_id, event_type, session_id, device_type, referrer)
         VALUES ${vals.join(',')}`,
        params,
      );
    }

    // Also bump the denormalised view_count for the post row
    await client.query(
      'UPDATE posts SET view_count = $1 WHERE id = $2',
      [views, postId],
    );
  }

  return inserted;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedMassive() {
  const client = await pool.connect();
  const startTime = Date.now();

  try {
    console.log('🌱  NeuralPost massive seed starting...');
    console.log(`    Target : ~${SECTIONS.length * PAGES_PER_SECTION * PAGE_SIZE} posts`);
    console.log(`    Sections: ${SECTIONS.length}  |  Pages/section: ${PAGES_PER_SECTION}  |  Per page: ${PAGE_SIZE}\n`);

    // ── 1. Tags ──────────────────────────────────────────────────────────────
    const allTagNames = [...new Set(SECTIONS.flatMap((s) => s.tags))];
    const tagIdCache  = {}; // slug → id

    for (const tag of allTagNames) {
      const slug = slugify(tag, { lower: true, strict: true });
      const row  = await client.query(
        `INSERT INTO tags (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, slug`,
        [tag, slug],
      );
      tagIdCache[row.rows[0].slug] = row.rows[0].id;
    }
    console.log(`✅  Tags ready (${allTagNames.length})`);

    // ── 2. Users ─────────────────────────────────────────────────────────────
    const passwordHash  = await bcrypt.hash('Password123!', 10);
    const createdUsers  = [];

    for (const u of DEMO_USERS) {
      const blogSlug = slugify(u.blogName, { lower: true, strict: true });
      const avatarUrl = `https://i.pravatar.cc/150?u=${u.username}`;
      const row = await client.query(
        `INSERT INTO users (email, username, password_hash, blog_name, blog_slug, avatar_url)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (email) DO UPDATE
           SET username = EXCLUDED.username,
               blog_name = EXCLUDED.blog_name,
               blog_slug = EXCLUDED.blog_slug,
               avatar_url = EXCLUDED.avatar_url
         RETURNING id, username`,
        [u.email, u.username, passwordHash, u.blogName, blogSlug, avatarUrl],
      );
      createdUsers.push(row.rows[0]);
    }
    console.log(`✅  Authors ready (${createdUsers.length})\n`);

    // ── 3. Fetch + insert articles ────────────────────────────────────────────
    let totalInserted = 0;
    const userCounter = { value: 0 };

    for (const section of SECTIONS) {
      console.log(`\n📰  Section: ${section.id}`);
      let sectionInserted = 0;
      let page = 1;
      let maxPages = PAGES_PER_SECTION;

      while (page <= maxPages) {
        // Fetch up to FETCH_CONCURRENCY pages in parallel
        const batch = [];
        for (let j = 0; j < FETCH_CONCURRENCY && page <= maxPages; j++, page++) {
          const p = page; // capture
          batch.push(() =>
            fetchGuardianPage(section.id, p)
              .then(r => ({ page: p, response: r }))
              .catch(err => { console.warn(`  ⚠️  ${section.id} p${p}: ${err.message}`); return null; })
          );
        }

        const responses = await pLimit(batch, FETCH_CONCURRENCY);

        for (const item of responses) {
          if (!item?.response) continue;
          const { response } = item;

          // Guardian tells us how many pages actually exist
          if (item.page === 1 && response.pages) {
            maxPages = Math.min(PAGES_PER_SECTION, response.pages);
          }

          const articles = response.results ?? [];
          if (articles.length === 0) continue;

          // Insert as a transaction
          await client.query('BEGIN');
          try {
            const n = await insertArticles(client, articles, section, createdUsers, tagIdCache, userCounter);
            await client.query('COMMIT');
            sectionInserted += n;
            process.stdout.write(`  p${item.page}:+${n} `);
          } catch (err) {
            await client.query('ROLLBACK');
            console.warn(`\n  ⚠️  Rolled back page ${item.page}: ${err.message}`);
          }
        }

        await sleep(FETCH_DELAY_MS * FETCH_CONCURRENCY);
      }

      totalInserted += sectionInserted;
      console.log(`\n  ✅  ${section.id}: ${sectionInserted} posts  (total so far: ${totalInserted})`);
    }

    // ── 4. Sample search queries ──────────────────────────────────────────────
    const queries = [
      'machine learning tutorial', 'react hooks', 'climate change solutions',
      'startup funding', 'book recommendations 2025', 'docker best practices',
      'ai writing tools', 'sustainable energy', 'typescript generics',
      'remote work productivity', 'science breakthroughs', 'creative writing tips',
      'film reviews 2025', 'music production', 'travel tips', 'healthy cooking',
      'political analysis', 'media literacy', 'sports analytics', 'green technology',
    ];
    for (const q of queries) {
      await client.query(
        `INSERT INTO search_queries (query, results_count) VALUES ($1,$2)`,
        [q, Math.floor(Math.random() * 80) + 5],
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉  Massive seed complete in ${elapsed}s!`);
    console.log(`    Posts inserted : ${totalInserted}`);
    console.log(`    Authors        : ${createdUsers.length}`);
    console.log(`    Tags           : ${allTagNames.length}`);
    console.log(`\n    Login: any email above, password: Password123!`);
    console.log(`    e.g.  alex@neuralpost.dev / Password123!\n`);

  } catch (err) {
    console.error('❌  Seed failed:', err);
    await client.query('ROLLBACK').catch(() => {});
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedMassive();
