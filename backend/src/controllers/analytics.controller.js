import db from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const trackEvent = asyncHandler(async (req, res) => {
  const { postId, eventType, sessionId, referrer, deviceType, country } = req.body;

  const validTypes = ['view', 'read_complete', 'share', 'search_click'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  await db.query(
    `INSERT INTO analytics_events (post_id, event_type, session_id, referrer, device_type, country)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [postId, eventType, sessionId, referrer, deviceType, country]
  );

  res.status(204).send();
});

export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [overview, topPosts, recentViews, readCompletion] = await Promise.all([
    // Total stats
    db.query(`
      SELECT
        COUNT(DISTINCT p.id) AS total_posts,
        COALESCE(SUM(p.view_count), 0) AS total_views,
        COUNT(DISTINCT ae.session_id) AS unique_visitors
      FROM posts p
      LEFT JOIN analytics_events ae ON ae.post_id = p.id
      WHERE p.user_id = $1 AND p.status = 'published'
    `, [userId]),

    // Top posts by views
    db.query(`
      SELECT p.id, p.title, p.slug, p.view_count,
             COALESCE(pas.total_reads, 0) AS total_reads,
             COALESCE(pas.read_completion_rate, 0) AS read_completion_rate
      FROM posts p
      LEFT JOIN post_analytics_summary pas ON pas.post_id = p.id
      WHERE p.user_id = $1 AND p.status = 'published'
      ORDER BY p.view_count DESC LIMIT 5
    `, [userId]),

    // Views over last 30 days
    db.query(`
      SELECT DATE(ae.created_at) AS date, COUNT(*) AS views
      FROM analytics_events ae
      JOIN posts p ON ae.post_id = p.id
      WHERE p.user_id = $1 AND ae.event_type = 'view'
        AND ae.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(ae.created_at)
      ORDER BY date ASC
    `, [userId]),

    // Read completion rate
    db.query(`
      SELECT ROUND(AVG(pas.read_completion_rate), 2) AS avg_completion_rate
      FROM post_analytics_summary pas
      JOIN posts p ON pas.post_id = p.id
      WHERE p.user_id = $1
    `, [userId]),
  ]);

  res.json({
    overview: overview.rows[0],
    topPosts: topPosts.rows,
    viewsTimeline: recentViews.rows,
    avgReadCompletionRate: readCompletion.rows[0]?.avg_completion_rate || 0,
  });
});

export const getPostAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await db.query('SELECT id FROM posts WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!post.rows[0]) return res.status(404).json({ error: 'Post not found' });

  const [summary, timeline, devices, referrers] = await Promise.all([
    db.query('SELECT * FROM post_analytics_summary WHERE post_id = $1', [id]),
    db.query(`
      SELECT DATE(created_at) AS date,
             COUNT(*) FILTER (WHERE event_type = 'view') AS views,
             COUNT(*) FILTER (WHERE event_type = 'read_complete') AS reads
      FROM analytics_events WHERE post_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date
    `, [id]),
    db.query(`
      SELECT device_type, COUNT(*) AS count
      FROM analytics_events WHERE post_id = $1 AND event_type = 'view'
      GROUP BY device_type
    `, [id]),
    db.query(`
      SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*) AS count
      FROM analytics_events WHERE post_id = $1 AND event_type = 'view'
      GROUP BY referrer ORDER BY count DESC LIMIT 10
    `, [id]),
  ]);

  res.json({
    summary: summary.rows[0] || {},
    timeline: timeline.rows,
    devices: devices.rows,
    referrers: referrers.rows,
  });
});

export const getSearchInsights = asyncHandler(async (req, res) => {
  const [topQueries, zeroResults] = await Promise.all([
    db.query(`
      SELECT query, COUNT(*) AS count, AVG(results_count) AS avg_results
      FROM search_queries
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY query ORDER BY count DESC LIMIT 20
    `),
    db.query(`
      SELECT query, COUNT(*) AS count
      FROM search_queries WHERE results_count = 0
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY query ORDER BY count DESC LIMIT 10
    `),
  ]);

  res.json({
    topQueries: topQueries.rows,
    zeroResultQueries: zeroResults.rows,
  });
});
