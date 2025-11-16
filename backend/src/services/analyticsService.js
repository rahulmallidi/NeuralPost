import db from '../config/db.js';

export async function refreshAnalyticsSummary() {
  await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY post_analytics_summary');
  console.log('Analytics materialized view refreshed');
}

export async function getTopPosts(days = 7, limit = 10) {
  const result = await db.query(`
    SELECT p.id, p.title, p.slug, u.username,
           COUNT(*) FILTER (WHERE ae.event_type = 'view') AS views,
           COUNT(*) FILTER (WHERE ae.event_type = 'read_complete') AS reads
    FROM analytics_events ae
    JOIN posts p ON ae.post_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE ae.created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY p.id, u.id
    ORDER BY views DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}
