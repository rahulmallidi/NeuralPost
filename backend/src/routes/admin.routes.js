import { Router } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import db from '../config/db.js';

const router = Router();

// ── One-time seed endpoint ────────────────────────────────────────────────────
// Protected by SEED_SECRET env var.
// Usage:  POST /api/admin/seed
//         Header: x-seed-secret: <your SEED_SECRET value>
//
// Safe to call multiple times — all inserts use ON CONFLICT DO NOTHING.
// Remove the SEED_SECRET env var from Render after seeding to disable this.

const SAMPLE_POSTS = [
  {
    title: 'Building Scalable APIs with Node.js and PostgreSQL',
    content: `# Building Scalable APIs with Node.js and PostgreSQL\n\nWhen building production APIs, the database layer is often the bottleneck. In this post, we explore connection pooling, query optimization, and caching strategies...\n\nConnection pooling is critical for PostgreSQL performance. Using pg-pool with a max of 20 connections prevents exhaustion under load.\n\n## Query Optimization\n\nUse EXPLAIN ANALYZE to understand query plans. Indexes on foreign keys and frequently filtered columns dramatically improve performance.\n\n## Caching with Redis\n\nImplement Redis caching for frequently-read, rarely-written data. Cache invalidation is the hard part — use time-based expiry as a safety net.`,
    tags: ['nodejs', 'postgresql', 'backend'],
  },
  {
    title: 'Understanding Transformer Models from Scratch',
    content: `# Understanding Transformer Models from Scratch\n\nThe transformer architecture revolutionized NLP. Let's break down attention mechanisms, positional encoding, and how BERT/GPT models are trained...\n\nSelf-attention allows every token to attend to every other token in the sequence. This captures long-range dependencies that RNNs struggled with.\n\n## Positional Encoding\n\nSince transformers process tokens in parallel, we must inject position information via sinusoidal encodings or learned embeddings.\n\n## Pre-training vs Fine-tuning\n\nModels like sentence-transformers are pre-trained on massive corpora and fine-tuned on specific tasks. For embeddings, contrastive learning produces semantically meaningful vector spaces.`,
    tags: ['machine learning', 'ai', 'python'],
  },
  {
    title: 'Docker Compose for Full-Stack Development',
    content: `# Docker Compose for Full-Stack Development\n\nDocker Compose transforms local development by providing reproducible environments. Here's how to set up a full-stack Node.js + PostgreSQL + Redis stack...\n\nDefine all services in docker-compose.yml. Use named volumes for PostgreSQL data persistence. Health checks ensure services start in the right order.\n\n## Networking\n\nServices communicate via their service names as hostnames. The postgres service is reachable as postgres:5432 from within the Docker network.`,
    tags: ['devops', 'docker', 'tutorial'],
  },
  {
    title: 'Vector Databases vs Traditional Search: When to Use Each',
    content: `# Vector Databases vs Traditional Search\n\nTraditional full-text search excels at exact and keyword matching. Vector search captures semantic similarity. But which should you use?\n\n## Hybrid Approaches\n\nReciprocal Rank Fusion (RRF) combines results from both systems. Semantic search finds conceptually similar content; keyword search catches exact matches.\n\n## Performance\n\nHNSW indexes make approximate nearest neighbor search near O(log n). At 100K vectors, query latency is under 5ms with pgvector HNSW.`,
    tags: ['database', 'ai', 'web development'],
  },
  {
    title: 'React 18 Concurrent Features Deep Dive',
    content: `# React 18 Concurrent Features Deep Dive\n\nReact 18 introduces concurrent rendering, useTransition, useDeferredValue, and Suspense improvements. Here's how to use them effectively...\n\nuseTransition marks state updates as non-urgent. UI stays responsive while expensive renders happen in the background.\n\n## Streaming SSR\n\nSuspense boundaries allow parts of the page to hydrate independently. Critical content loads fast; non-critical content streams in without blocking.`,
    tags: ['react', 'javascript', 'web development'],
  },
  {
    title: 'TypeScript Advanced Patterns for Large Codebases',
    content: `# TypeScript Advanced Patterns for Large Codebases\n\nAs TypeScript projects grow, type safety becomes increasingly valuable but also increasingly complex. Here are patterns that scale...\n\n## Discriminated Unions\n\nModel state machines with discriminated unions. TypeScript's narrowing makes exhaustive checks automatic.\n\n## Branded Types\n\nPrevent mixing up primitive types with branded types. A UserId should never be assignable to a PostId.`,
    tags: ['typescript', 'javascript', 'web development'],
  },
  {
    title: 'PostgreSQL Performance Tuning: 10 Essential Tips',
    content: `# PostgreSQL Performance Tuning: 10 Essential Tips\n\n1. Use connection pooling\n2. Create appropriate indexes\n3. Use EXPLAIN ANALYZE before optimizing\n4. Configure shared_buffers (25% of RAM)\n5. Enable pg_stat_statements for query monitoring\n6. Use partial indexes for filtered queries\n7. Partition large tables by month\n8. Vacuum and analyze regularly\n9. Use materialized views for expensive aggregations\n10. Consider read replicas for analytics workloads`,
    tags: ['postgresql', 'database', 'backend'],
  },
  {
    title: 'Building a Real-Time Analytics Dashboard',
    content: `# Building a Real-Time Analytics Dashboard\n\nTrack page views, read completion, and user journeys without slowing down your app.\n\n## Event Collection\n\nUse navigator.sendBeacon for fire-and-forget event tracking. It survives page unload and doesn't block the main thread.\n\n## Aggregation Strategy\n\nRaw event tables grow fast. PostgreSQL materialized views aggregate millions of rows into summaries that query in milliseconds.`,
    tags: ['analytics', 'react', 'postgresql'],
  },
];

const TAGS = ['javascript', 'python', 'machine learning', 'web development', 'devops',
              'database', 'ai', 'backend', 'react', 'nodejs', 'typescript', 'docker',
              'tutorial', 'analytics', 'postgresql'];

router.post('/seed', async (req, res) => {
  const secret = process.env.SEED_SECRET;

  // If SEED_SECRET is not set at all, endpoint is disabled.
  if (!secret) {
    return res.status(403).json({ error: 'Seed endpoint is disabled. Set SEED_SECRET env var to enable.' });
  }

  if (req.headers['x-seed-secret'] !== secret) {
    return res.status(403).json({ error: 'Invalid seed secret.' });
  }

  const client = await db.getClient();
  const log = [];

  try {
    // Tags
    for (const tag of TAGS) {
      const slug = slugify(tag, { lower: true, strict: true });
      await client.query(
        'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
        [tag, slug]
      );
    }
    log.push('tags seeded');

    // Users
    const users = [
      { email: 'alice@neuralpost.dev', username: 'alice_dev', blogName: "Alice's Tech Blog" },
      { email: 'bob@neuralpost.dev',   username: 'bob_ml',    blogName: "Bob's ML Corner" },
      { email: 'carol@neuralpost.dev', username: 'carol_codes', blogName: 'Carol Codes' },
    ];

    const createdUsers = [];
    for (const u of users) {
      const hash = await bcrypt.hash('Password123!', 10);
      const blogSlug = slugify(u.blogName, { lower: true, strict: true });
      const result = await client.query(`
        INSERT INTO users (email, username, password_hash, blog_name, blog_slug)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
        RETURNING id, username
      `, [u.email, u.username, hash, u.blogName, blogSlug]);
      createdUsers.push(result.rows[0]);
    }
    log.push(`users seeded: ${createdUsers.map(u => u.username).join(', ')}`);

    // Posts
    let postCount = 0;
    for (let i = 0; i < SAMPLE_POSTS.length; i++) {
      const p = SAMPLE_POSTS[i];
      const user = createdUsers[i % createdUsers.length];
      const slug = slugify(p.title, { lower: true, strict: true });
      const wordCount = p.content.split(/\s+/).length;
      const readingTime = Math.ceil(wordCount / 200);

      const result = await client.query(`
        INSERT INTO posts (user_id, title, slug, content, content_html, excerpt, status, reading_time_mins, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, NOW() - INTERVAL '${i} days')
        ON CONFLICT (user_id, slug) DO NOTHING
        RETURNING id
      `, [
        user.id, p.title, slug, p.content,
        `<p>${p.content.substring(0, 200)}...</p>`,
        p.content.substring(0, 150).replace(/#+\s/g, '') + '...',
        readingTime,
      ]);

      if (result.rows[0]) {
        postCount++;
        for (const tagName of p.tags) {
          const tagSlug = slugify(tagName, { lower: true, strict: true });
          const tag = await client.query('SELECT id FROM tags WHERE slug = $1', [tagSlug]);
          if (tag.rows[0]) {
            await client.query(
              'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [result.rows[0].id, tag.rows[0].id]
            );
          }
        }

        // Light analytics events per post
        for (let j = 0; j < 15; j++) {
          await client.query(`
            INSERT INTO analytics_events (post_id, event_type, session_id, device_type)
            VALUES ($1, $2, $3, $4)
          `, [
            result.rows[0].id,
            ['view', 'read_complete', 'view', 'view'][Math.floor(Math.random() * 4)],
            `session-${Math.random().toString(36).substr(2, 9)}`,
            ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
          ]);
        }
      }
    }
    log.push(`posts seeded: ${postCount}`);

    return res.json({ ok: true, log });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: err.message, log });
  } finally {
    client.release(); // release back to pool — never call pool.end() in a route
  }
});

// ── Massive seed endpoint (fire-and-forget) ───────────────────────────────────
// Fetches ~10 500 real articles from The Guardian and inserts them.
// Takes ~2 min — responds 202 immediately, logs progress to Render console.
// Usage:  POST /api/admin/seed-massive
//         Header: x-seed-secret: <SEED_SECRET>
// Requires GUARDIAN_API_KEY to be set in environment.

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

const MASSIVE_USERS = [
  { email: 'alex@neuralpost.dev',   username: 'alex_writes',   blogName: "Alex's Notebook" },
  { email: 'priya@neuralpost.dev',  username: 'priya_dev',     blogName: "Priya's Dev Corner" },
  { email: 'james@neuralpost.dev',  username: 'james_ml',      blogName: "James on Machine Learning" },
  { email: 'sofia@neuralpost.dev',  username: 'sofia_science', blogName: "Sofia Explores Science" },
  { email: 'carlos@neuralpost.dev', username: 'carlos_biz',    blogName: "Carlos Business Pulse" },
  { email: 'yuki@neuralpost.dev',   username: 'yuki_culture',  blogName: "Yuki on Culture" },
  { email: 'emma@neuralpost.dev',   username: 'emma_env',      blogName: "Emma Green World" },
  { email: 'liam@neuralpost.dev',   username: 'liam_reads',    blogName: "Liam's Reading List" },
  { email: 'nina@neuralpost.dev',   username: 'nina_edu',      blogName: "Nina Learns" },
  { email: 'omar@neuralpost.dev',   username: 'omar_writes',   blogName: "Omar Across Topics" },
];

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];
const REFERRERS    = ['https://google.com', 'https://twitter.com', 'direct', null];
const sleep        = (ms) => new Promise(r => setTimeout(r, ms));
const stripHtml    = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();

async function fetchGuardianPage(key, section, page) {
  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('api-key',    key);
  url.searchParams.set('section',    section);
  url.searchParams.set('page-size',  '50');
  url.searchParams.set('page',       String(page));
  url.searchParams.set('show-fields','body,thumbnail,byline,wordcount,trailText,headline');
  url.searchParams.set('order-by',   'newest');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
      if (res.status === 429) { await sleep(5000); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.response;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * attempt);
    }
  }
}

async function runMassiveSeed() {
  const GUARDIAN_KEY = process.env.GUARDIAN_API_KEY;
  if (!GUARDIAN_KEY) { console.error('[seed-massive] GUARDIAN_API_KEY not set'); return; }

  const client = await db.getClient();
  const start  = Date.now();
  console.log('[seed-massive] Starting...');

  try {
    // Tags
    const allTags = [...new Set(SECTIONS.flatMap(s => s.tags))];
    const tagIdCache = {};
    for (const tag of allTags) {
      const s = slugify(tag, { lower: true, strict: true });
      const row = await client.query(
        `INSERT INTO tags (name, slug) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id, slug`,
        [tag, s]
      );
      tagIdCache[row.rows[0].slug] = row.rows[0].id;
    }
    console.log(`[seed-massive] Tags: ${allTags.length}`);

    // Users
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const createdUsers = [];
    for (const u of MASSIVE_USERS) {
      const blogSlug = slugify(u.blogName, { lower: true, strict: true });
      const row = await client.query(
        `INSERT INTO users (email, username, password_hash, blog_name, blog_slug)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET username=EXCLUDED.username RETURNING id, username`,
        [u.email, u.username, passwordHash, u.blogName, blogSlug]
      );
      createdUsers.push(row.rows[0]);
    }
    console.log(`[seed-massive] Users: ${createdUsers.length}`);

    let totalInserted = 0;
    let userIdx = 0;

    for (const section of SECTIONS) {
      console.log(`[seed-massive] Section: ${section.id}`);
      let sectionInserted = 0;

      for (let page = 1; page <= 15; page++) {
        try {
          const response = await fetchGuardianPage(GUARDIAN_KEY, section.id, page);
          const articles = response?.results ?? [];
          if (articles.length === 0) break;

          await client.query('BEGIN');
          for (const article of articles) {
            const fields   = article.fields ?? {};
            const title    = fields.headline || article.webTitle;
            if (!title?.trim()) continue;
            const baseSlug = slugify(title, { lower: true, strict: true }).slice(0, 90);
            const epoch    = new Date(article.webPublicationDate).getTime();
            const slug     = `${baseSlug}-${epoch}`;
            const content  = `# ${title}\n\n${stripHtml(fields.body || fields.trailText || '')}`;
            const excerpt  = (fields.trailText || content.substring(0, 200)) + '…';
            const readMins = Math.max(1, Math.ceil((parseInt(fields.wordcount, 10) || 600) / 220));
            const user     = createdUsers[userIdx % createdUsers.length];
            userIdx++;

            const postRow = await client.query(
              `INSERT INTO posts (user_id, title, slug, content, content_html, excerpt, cover_image_url, status, reading_time_mins, published_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9) ON CONFLICT (user_id, slug) DO NOTHING RETURNING id`,
              [user.id, title, slug, content, fields.body || `<p>${excerpt}</p>`, excerpt,
               fields.thumbnail || null, readMins, article.webPublicationDate || new Date()]
            );
            if (!postRow.rows[0]) continue;
            const postId = postRow.rows[0].id;
            sectionInserted++;

            for (const tagName of section.tags) {
              const tagId = tagIdCache[slugify(tagName, { lower: true, strict: true })];
              if (tagId) await client.query(
                'INSERT INTO post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                [postId, tagId]
              );
            }

            // Light analytics per post
            for (let v = 0; v < 15; v++) {
              await client.query(
                `INSERT INTO analytics_events (post_id, event_type, session_id, device_type, referrer) VALUES ($1,$2,$3,$4,$5)`,
                [postId, v % 4 === 0 ? 'read_complete' : 'view',
                 `sess-${Math.random().toString(36).slice(2,11)}`,
                 DEVICE_TYPES[v % 3], REFERRERS[v % 4]]
              );
            }
          }
          await client.query('COMMIT');
          await sleep(300);
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          console.warn(`[seed-massive] ${section.id} p${page} error: ${err.message}`);
        }
      }

      totalInserted += sectionInserted;
      console.log(`[seed-massive] ${section.id}: ${sectionInserted} posts (total: ${totalInserted})`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[seed-massive] Done in ${elapsed}s — ${totalInserted} posts inserted`);
  } catch (err) {
    console.error('[seed-massive] Fatal:', err.message);
    await client.query('ROLLBACK').catch(() => {});
  } finally {
    client.release(); // return to pool — never call pool.end() in a route
  }
}

router.post('/seed-massive', async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret) return res.status(403).json({ error: 'Seed endpoint disabled. Set SEED_SECRET to enable.' });
  if (req.headers['x-seed-secret'] !== secret) return res.status(403).json({ error: 'Invalid seed secret.' });
  if (!process.env.GUARDIAN_API_KEY) return res.status(400).json({ error: 'GUARDIAN_API_KEY not set in environment.' });

  // Respond immediately — seeding runs in background, follow progress in Render logs
  res.status(202).json({ ok: true, message: 'Massive seed started in background. Watch Render logs for progress.' });

  // Fire and forget
  runMassiveSeed().catch(err => console.error('[seed-massive] Unhandled:', err.message));
});

export default router;
