/**
 * seed_analytics.js
 *
 * Generates 1,000,000+ synthetic analytics events spread across all published posts.
 * Uses PostgreSQL generate_series + CTEs for pure SQL insertion — no row-by-row JS loops.
 * Typical runtime: < 30s for 1M rows on local postgres.
 *
 * Usage:
 *   node --env-file=../.env seed/seed_analytics.js
 *   node --env-file=../.env seed/seed_analytics.js --events 2000000
 */

import db from '../src/config/db.js';

const TARGET_EVENTS = parseInt(
  process.argv.find(a => a.startsWith('--events='))?.split('=')[1] ?? '1000000'
);

const EVENT_TYPES    = ['view', 'view', 'view', 'read_complete', 'share', 'search_click']; // weighted
const DEVICE_TYPES   = ['desktop', 'desktop', 'mobile', 'mobile', 'tablet'];
const COUNTRIES      = ['US', 'US', 'US', 'IN', 'GB', 'DE', 'CA', 'BR', 'FR', 'AU', 'JP', 'NG'];
const REFERRERS      = [
  'https://google.com', 'https://twitter.com', 'https://reddit.com',
  'https://hackernews.com', 'direct', 'https://linkedin.com', null, null,
];

console.log(`\n🌱 Seeding ${TARGET_EVENTS.toLocaleString()} analytics events...\n`);

async function main() {
  // 1. Get all published post IDs
  const { rows: posts } = await db.query(`
    SELECT id FROM posts WHERE status = 'published' LIMIT 5000
  `);

  if (posts.length === 0) {
    console.error('❌ No published posts found. Run seed_massive.js first.');
    process.exit(1);
  }

  console.log(`📋 Targeting ${posts.length} published posts`);

  // 2. Check existing count
  const { rows: [{ count: existing }] } = await db.query(
    'SELECT COUNT(*) FROM analytics_events'
  );
  console.log(`📊 Existing events: ${Number(existing).toLocaleString()}`);

  const needed = Math.max(0, TARGET_EVENTS - Number(existing));
  if (needed === 0) {
    console.log(`✅ Already have ${Number(existing).toLocaleString()} events — target reached.`);
    process.exit(0);
  }

  console.log(`➕ Inserting ${needed.toLocaleString()} more events in batches...\n`);

  // 3. Build lookup arrays as PostgreSQL arrays for use inside SQL
  const postIds    = posts.map(p => p.id);
  const eventArr   = EVENT_TYPES;
  const deviceArr  = DEVICE_TYPES;
  const countryArr = COUNTRIES;
  const referrArr  = REFERRERS.filter(Boolean);

  // 4. Insert in 100K-row batches using generate_series + random array picks
  const BATCH_SIZE = 100_000;
  let inserted = 0;

  while (inserted < needed) {
    const batchCount = Math.min(BATCH_SIZE, needed - inserted);

    // Pure SQL batch: generate_series provides row numbers,
    // array indexing with MOD picks deterministic-but-varied values.
    await db.query(`
      INSERT INTO analytics_events
        (post_id, event_type, session_id, referrer, country, device_type, created_at)
      SELECT
        ($1::uuid[])[1 + (floor(random() * $2)::int)],
        ($3::text[])[1 + (n % $4)],
        'sess-' || n || '-' || floor(random() * 999999)::text,
        ($5::text[])[1 + (n % $6)],
        ($7::text[])[1 + (n % $8)],
        ($9::text[])[1 + (n % $10)],
        NOW() - (random() * interval '365 days')
      FROM generate_series(1, $11) AS n
    `, [
      postIds,           postIds.length,         // $1, $2
      eventArr,          eventArr.length,         // $3, $4
      referrArr,         referrArr.length,        // $5, $6
      countryArr,        countryArr.length,       // $7, $8
      deviceArr,         deviceArr.length,        // $9, $10
      batchCount,                                 // $11
    ]);

    inserted += batchCount;
    const total = Number(existing) + inserted;
    process.stdout.write(
      `\r  ${inserted.toLocaleString()} / ${needed.toLocaleString()} inserted` +
      `  (total: ${total.toLocaleString()})`
    );
  }

  // 5. Refresh the materialized view so dashboard queries reflect new data
  console.log('\n\n🔄 Refreshing post_analytics_summary materialized view...');
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY post_analytics_summary');

  // 6. Sync view_count on posts table from the materialized view
  console.log('🔄 Syncing view_count on posts table...');
  await db.query(`
    UPDATE posts p
    SET view_count = pas.total_views
    FROM post_analytics_summary pas
    WHERE p.id = pas.post_id
  `);

  // 7. Final count
  const { rows: [{ count: finalCount }] } = await db.query(
    'SELECT COUNT(*) FROM analytics_events'
  );

  console.log(`\n✅ Done! Total analytics events: ${Number(finalCount).toLocaleString()}`);
  console.log('✅ Materialized view refreshed.');
  console.log('✅ Post view counts synced.\n');
}

main()
  .catch(err => { console.error('\n❌ Error:', err.message); process.exit(1); })
  .finally(() => db.end?.());
