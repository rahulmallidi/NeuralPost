import pg from 'pg';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SAMPLE_POSTS = [
  {
    title: 'Building Scalable APIs with Node.js and PostgreSQL',
    content: `# Building Scalable APIs with Node.js and PostgreSQL\n\nWhen building production APIs, the database layer is often the bottleneck. In this post, we explore connection pooling, query optimization, and caching strategies...\n\nConnection pooling is critical for PostgreSQL performance. Using pg-pool with a max of 20 connections prevents exhaustion under load.\n\n## Query Optimization\n\nUse EXPLAIN ANALYZE to understand query plans. Indexes on foreign keys and frequently filtered columns dramatically improve performance.\n\n## Caching with Redis\n\nImplement Redis caching for frequently-read, rarely-written data. Cache invalidation is the hard part — use time-based expiry as a safety net.`,
    tags: ['nodejs', 'postgresql', 'backend'],
  },
  {
    title: 'Understanding Transformer Models from Scratch',
    content: `# Understanding Transformer Models from Scratch\n\nThe transformer architecture revolutionized NLP. Let's break down attention mechanisms, positional encoding, and how BERT/GPT models are trained...\n\nSelf-attention allows every token to attend to every other token in the sequence. This captures long-range dependencies that RNNs struggled with.\n\n## Positional Encoding\n\nSince transformers process tokens in parallel, we must inject position information via sinusoidal encodings or learned embeddings.\n\n## Pre-training vs Fine-tuning\n\nModels like sentence-transformers are pre-trained on massive corpora and fine-tuned on specific tasks. For embeddings, contrastive learning (SimCSE, MNRL) produces semantically meaningful vector spaces.`,
    tags: ['machine learning', 'ai', 'python'],
  },
  {
    title: 'Docker Compose for Full-Stack Development',
    content: `# Docker Compose for Full-Stack Development\n\nDocker Compose transforms local development by providing reproducible environments. Here's how to set up a full-stack Node.js + PostgreSQL + Redis stack...\n\nDefine all services in docker-compose.yml. Use named volumes for PostgreSQL data persistence. Health checks ensure services start in the right order.\n\n## Networking\n\nServices communicate via their service names as hostnames. The postgres service is reachable as postgres:5432 from within the Docker network.`,
    tags: ['devops', 'docker', 'tutorial'],
  },
  {
    title: 'Vector Databases vs Traditional Search: When to Use Each',
    content: `# Vector Databases vs Traditional Search\n\nTraditional full-text search (Elasticsearch, PostgreSQL tsvector) excels at exact and keyword matching. Vector search (pgvector, Pinecone, Weaviate) captures semantic similarity. But which should you use?\n\n## Hybrid Approaches\n\nReciprocal Rank Fusion (RRF) combines results from both systems. Semantic search finds conceptually similar content; keyword search catches exact matches. RRF merges ranked lists without needing to tune weights.\n\n## Performance\n\nHNSW indexes make approximate nearest neighbor search near O(log n). At 100K vectors, query latency is under 5ms with pgvector HNSW.`,
    tags: ['database', 'ai', 'web development'],
  },
  {
    title: 'React 18 Concurrent Features Deep Dive',
    content: `# React 18 Concurrent Features Deep Dive\n\nReact 18 introduces concurrent rendering, useTransition, useDeferredValue, and Suspense improvements. Here's how to use them effectively...\n\nuseTransition marks state updates as non-urgent. UI stays responsive while expensive renders happen in the background.\n\n## Streaming SSR\n\nSuspense boundaries allow parts of the page to hydrate independently. Critical content loads fast; non-critical content streams in without blocking.\n\n## When NOT to Use Concurrent Features\n\nNot every state update needs to be concurrent. Use useTransition only when you have expensive renders that you want to deprioritize.`,
    tags: ['react', 'javascript', 'web development'],
  },
  {
    title: 'TypeScript Advanced Patterns for Large Codebases',
    content: `# TypeScript Advanced Patterns for Large Codebases\n\nAs TypeScript projects grow, type safety becomes increasingly valuable but also increasingly complex. Here are patterns that scale...\n\n## Discriminated Unions\n\nModel state machines with discriminated unions. TypeScript's narrowing makes exhaustive checks automatic.\n\n## Template Literal Types\n\nBuild type-safe event systems with template literal types. No more magic strings.\n\n## Branded Types\n\nPrevent mixing up primitive types with branded/nominal types. A UserId should never be assignable to a PostId.`,
    tags: ['typescript', 'javascript', 'web development'],
  },
  {
    title: 'PostgreSQL Performance Tuning: 10 Essential Tips',
    content: `# PostgreSQL Performance Tuning: 10 Essential Tips\n\n1. Use connection pooling (PgBouncer or pg-pool)\n2. Create appropriate indexes — don't over-index\n3. Use EXPLAIN ANALYZE before optimizing\n4. Configure shared_buffers (25% of RAM)\n5. Enable pg_stat_statements for query monitoring\n6. Use partial indexes for filtered queries\n7. Partition large tables (analytics_events by month)\n8. Vacuum and analyze regularly\n9. Use materialized views for expensive aggregations\n10. Consider read replicas for analytics workloads`,
    tags: ['postgresql', 'database', 'backend'],
  },
  {
    title: 'Building a Real-Time Analytics Dashboard',
    content: `# Building a Real-Time Analytics Dashboard\n\nTrack page views, read completion, and user journeys without slowing down your app. Here's a battle-tested approach...\n\n## Event Collection\n\nUse navigator.sendBeacon for fire-and-forget event tracking. It survives page unload and doesn't block the main thread.\n\n## Aggregation Strategy\n\nRaw event tables grow fast. PostgreSQL materialized views aggregate millions of rows into summaries that query in milliseconds.\n\n## Visualization\n\nRecharts + TanStack Query gives you reactive charts that stay fresh with minimal boilerplate.`,
    tags: ['analytics', 'react', 'postgresql'],
  },
];

const TAGS = ['javascript', 'python', 'machine learning', 'web development', 'devops', 'database', 'ai', 'backend', 'react', 'nodejs', 'typescript', 'docker', 'tutorial', 'analytics', 'postgresql'];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting seed...');

    // Seed tags
    for (const tag of TAGS) {
      const slug = slugify(tag, { lower: true, strict: true });
      await client.query(
        'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
        [tag, slug]
      );
    }
    console.log('✅ Tags seeded');

    // Create demo users
    const users = [
      { email: 'alice@neuralpost.dev', username: 'alice_dev', blogName: "Alice's Tech Blog" },
      { email: 'bob@neuralpost.dev', username: 'bob_ml', blogName: "Bob's ML Corner" },
      { email: 'carol@neuralpost.dev', username: 'carol_codes', blogName: "Carol Codes" },
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
    console.log('✅ Users seeded');

    // Seed posts
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

        // Seed analytics events
        for (let j = 0; j < Math.floor(Math.random() * 50) + 10; j++) {
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
    console.log('✅ Posts and analytics seeded');
    console.log('🎉 Seed complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
