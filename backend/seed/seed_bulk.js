/**
 * NeuralPost — Bulk Seed Script (1000+ genuine posts)
 *
 * Content source : The Guardian Open Platform API (free)
 *   → Get your free key in ~60 seconds at:
 *     https://open-platform.theguardian.com/access/support-us
 *   → Then run:  GUARDIAN_API_KEY=your_key node seed/seed_bulk.js
 *   → The default "test" key works but is heavily rate-limited (~10 posts demo).
 *
 * Images       : Picsum Photos  — free, no key, beautiful photos keyed by slug
 * Target       : ~1 050 posts across 10 demo authors, 7 topic sections
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GUARDIAN_KEY = process.env.GUARDIAN_API_KEY || 'test';
const PAGE_SIZE = 50;   // max 200 on free tier; 50 is safe & fast
const PAGES_PER_SECTION = 3; // 3 pages × 50 × 7 sections = 1 050 posts

// ─── Sections to pull from The Guardian ──────────────────────────────────────
const SECTIONS = [
  { id: 'technology',  tags: ['technology', 'software', 'programming', 'web-development'] },
  { id: 'science',     tags: ['science', 'research', 'innovation', 'ai'] },
  { id: 'business',    tags: ['business', 'startups', 'finance', 'entrepreneurship'] },
  { id: 'culture',     tags: ['culture', 'arts', 'society', 'creativity'] },
  { id: 'environment', tags: ['environment', 'climate', 'sustainability', 'green-tech'] },
  { id: 'education',   tags: ['education', 'learning', 'productivity', 'career'] },
  { id: 'books',       tags: ['books', 'writing', 'storytelling', 'literature'] },
];

// ─── Demo authors ─────────────────────────────────────────────────────────────
const DEMO_USERS = [
  { email: 'alex@neuralpost.dev',   username: 'alex_writes',   blogName: "Alex's Notebook",        avatar: 'https://i.pravatar.cc/150?u=alex' },
  { email: 'priya@neuralpost.dev',  username: 'priya_dev',     blogName: "Priya's Dev Corner",      avatar: 'https://i.pravatar.cc/150?u=priya' },
  { email: 'james@neuralpost.dev',  username: 'james_ml',      blogName: "James on Machine Learning", avatar: 'https://i.pravatar.cc/150?u=james' },
  { email: 'sofia@neuralpost.dev',  username: 'sofia_science', blogName: "Sofia Explores Science",  avatar: 'https://i.pravatar.cc/150?u=sofia' },
  { email: 'carlos@neuralpost.dev', username: 'carlos_biz',    blogName: "Carlos Business Pulse",   avatar: 'https://i.pravatar.cc/150?u=carlos' },
  { email: 'yuki@neuralpost.dev',   username: 'yuki_culture',  blogName: "Yuki on Culture",         avatar: 'https://i.pravatar.cc/150?u=yuki' },
  { email: 'emma@neuralpost.dev',   username: 'emma_env',      blogName: "Emma Green World",        avatar: 'https://i.pravatar.cc/150?u=emma' },
  { email: 'liam@neuralpost.dev',   username: 'liam_reads',    blogName: "Liam's Reading List",     avatar: 'https://i.pravatar.cc/150?u=liam' },
  { email: 'nina@neuralpost.dev',   username: 'nina_edu',      blogName: "Nina Learns",             avatar: 'https://i.pravatar.cc/150?u=nina' },
  { email: 'omar@neuralpost.dev',   username: 'omar_writes',   blogName: "Omar Across Topics",      avatar: 'https://i.pravatar.cc/150?u=omar' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Polite delay so we never hammer the Guardian API. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Estimate reading time from word count. */
const readingTime = (words) => Math.max(1, Math.ceil((words || 600) / 220));

/** Strip HTML tags (Guardian body comes as HTML). */
const stripHtml = (html = '') =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** Build a deterministic Picsum cover URL from the post slug. */
const coverImage = (slug, width = 1200, height = 630) =>
  `https://picsum.photos/seed/${encodeURIComponent(slug)}/${width}/${height}`;

/** Fetch one page of articles from The Guardian. */
async function fetchGuardianPage(section, page) {
  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('api-key', GUARDIAN_KEY);
  url.searchParams.set('section', section);
  url.searchParams.set('page-size', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('show-fields', 'body,thumbnail,byline,wordcount,trailText,headline');
  url.searchParams.set('order-by', 'newest');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Guardian API ${res.status} on section=${section} page=${page}: ${text}`);
  }
  const json = await res.json();
  return json.response; // { results, pages, total, ... }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedBulk() {
  const client = await pool.connect();
  try {
    console.log('🌱  NeuralPost bulk seed starting...\n');

    // ── 1. Tags ──────────────────────────────────────────────────────────────
    const allTags = [...new Set(SECTIONS.flatMap((s) => s.tags))];
    for (const tag of allTags) {
      const slug = slugify(tag, { lower: true, strict: true });
      await client.query(
        'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
        [tag, slug],
      );
    }
    console.log(`✅  Tags seeded (${allTags.length})`);

    // ── 2. Users ─────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const createdUsers = [];

    for (const u of DEMO_USERS) {
      const blogSlug = slugify(u.blogName, { lower: true, strict: true });
      const row = await client.query(
        `INSERT INTO users (email, username, password_hash, blog_name, blog_slug, avatar_url)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (email) DO UPDATE
           SET username = EXCLUDED.username,
               blog_name = EXCLUDED.blog_name,
               blog_slug = EXCLUDED.blog_slug
         RETURNING id, username`,
        [u.email, u.username, passwordHash, u.blogName, blogSlug, u.avatar],
      );
      createdUsers.push(row.rows[0]);
    }
    console.log(`✅  Users seeded (${createdUsers.length})`);

    // ── 3. Articles from The Guardian ────────────────────────────────────────
    let totalInserted = 0;
    let userIndex = 0;

    for (const section of SECTIONS) {
      console.log(`\n📰  Fetching section: ${section.id}`);

      for (let page = 1; page <= PAGES_PER_SECTION; page++) {
        let response;
        try {
          response = await fetchGuardianPage(section.id, page);
        } catch (err) {
          console.warn(`  ⚠️  Skipping ${section.id} page ${page}: ${err.message}`);
          break;
        }

        const articles = response.results ?? [];
        if (articles.length === 0) break;

        console.log(`  Page ${page}/${PAGES_PER_SECTION} — ${articles.length} articles`);

        for (const article of articles) {
          const fields = article.fields ?? {};

          // Build rich content — use body HTML if available, fall back to trailText
          const rawBody = fields.body || '';
          const plainBody = stripHtml(rawBody);
          const contentHtml = rawBody ||
            `<p>${fields.trailText || fields.headline || article.webTitle}</p>`;

          // Build markdown-ish plain content for embedding
          const content = `# ${article.webTitle}\n\n${plainBody || fields.trailText || ''}`;

          const title = fields.headline || article.webTitle;
          if (!title) continue;

          // Deduplicate slugs by appending publication epoch
          const baseSlug = slugify(title, { lower: true, strict: true }).slice(0, 90);
          const epoch = new Date(article.webPublicationDate).getTime();
          const slug = `${baseSlug}-${epoch}`;

          const excerpt = (fields.trailText || plainBody.substring(0, 200) || title) + '…';
          const wordCount = parseInt(fields.wordcount, 10) || plainBody.split(/\s+/).length;
          const readMins = readingTime(wordCount);
          const cover = fields.thumbnail || coverImage(baseSlug);
          const pubDate = article.webPublicationDate || new Date().toISOString();
          const user = createdUsers[userIndex % createdUsers.length];
          userIndex++;

          // Insert post
          const postRow = await client.query(
            `INSERT INTO posts
               (user_id, title, slug, content, content_html, excerpt,
                cover_image_url, status, reading_time_mins, published_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9)
             ON CONFLICT (user_id, slug) DO NOTHING
             RETURNING id`,
            [user.id, title, slug, content, contentHtml, excerpt,
             cover, readMins, pubDate],
          );

          if (!postRow.rows[0]) continue; // duplicate slug — skip
          const postId = postRow.rows[0].id;
          totalInserted++;

          // Attach tags from the section
          for (const tagName of section.tags) {
            const tagSlug = slugify(tagName, { lower: true, strict: true });
            const tagRow = await client.query('SELECT id FROM tags WHERE slug=$1', [tagSlug]);
            if (tagRow.rows[0]) {
              await client.query(
                'INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                [postId, tagRow.rows[0].id],
              );
            }
          }

          // Seed analytics events — realistic distribution
          const views = Math.floor(Math.random() * 800) + 20;
          const reads = Math.floor(views * (0.2 + Math.random() * 0.5));
          const deviceTypes = ['desktop', 'mobile', 'tablet'];
          const referrers = ['https://google.com', 'https://twitter.com', 'direct', 'https://hn.algolia.com', null];

          const analyticsRows = [];
          for (let v = 0; v < Math.min(views, 30); v++) {
            analyticsRows.push([
              postId,
              v < reads ? (v % 5 === 0 ? 'read_complete' : 'view') : 'view',
              `sess-${Math.random().toString(36).slice(2, 11)}`,
              deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
              referrers[Math.floor(Math.random() * referrers.length)],
            ]);
          }

          for (const [pid, evtype, sess, dev, ref] of analyticsRows) {
            await client.query(
              `INSERT INTO analytics_events (post_id, event_type, session_id, device_type, referrer)
               VALUES ($1,$2,$3,$4,$5)`,
              [pid, evtype, sess, dev, ref],
            );
          }
        }

        // Polite delay: ~1 req/sec (well within free-tier rate limits)
        await sleep(1100);
      }
    }

    // ── 4. Sample search queries log ─────────────────────────────────────────
    const sampleQueries = [
      'machine learning tutorial', 'react hooks', 'climate change solutions',
      'startup funding', 'book recommendations 2025', 'docker best practices',
      'ai writing tools', 'sustainable energy', 'typescript generics',
      'remote work productivity', 'science breakthroughs', 'creative writing tips',
    ];
    for (const q of sampleQueries) {
      await client.query(
        `INSERT INTO search_queries (query, results_count) VALUES ($1, $2)`,
        [q, Math.floor(Math.random() * 30) + 1],
      );
    }

    console.log(`\n🎉  Bulk seed complete!`);
    console.log(`    Posts inserted : ${totalInserted}`);
    console.log(`    Authors        : ${createdUsers.length}`);
    console.log(`    Tags           : ${allTags.length}`);
    console.log(`\n    Login with any author — password: Password123!`);
    console.log(`    e.g.  alex@neuralpost.dev / Password123!`);

  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedBulk();
