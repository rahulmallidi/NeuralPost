import db from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const trackEvent = asyncHandler(async (req, res) => {
  const { postId, eventType, sessionId, referrer, deviceType, country } = req.body;

  const validTypes = ['view', 'read_complete', 'search_click'];
  if (!validTypes.includes(eventType)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  await db.query(
    `INSERT INTO analytics_events (post_id, event_type, session_id, referrer, device_type, country)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [postId, eventType, sessionId, referrer, deviceType, country]
  );

  // Increment view_count only on first view per session (deduplication)
  if (eventType === 'view' && sessionId) {
    const prior = await db.query(
      `SELECT 1 FROM analytics_events
       WHERE post_id = $1 AND session_id = $2 AND event_type = 'view'
       LIMIT 2`,
      [postId, sessionId]
    );
    // prior.rowCount includes the row we just inserted; 1 means it's the first
    if (prior.rowCount === 1) {
      db.query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [postId]);
    }
  }

  res.status(204).send();
});

export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const days   = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

  const [overview, prevPeriod, topPosts, timeline, readCompletion, devices, referrers, countries] =
    await Promise.all([
      // ── Current period totals ───────────────────────────────────────────
      db.query(`
        SELECT
          (SELECT COUNT(*)::int
             FROM posts WHERE user_id = $1 AND status = 'published') AS total_posts,
          (SELECT COALESCE(SUM(view_count), 0)::int
             FROM posts WHERE user_id = $1 AND status = 'published') AS total_views,
          (SELECT COUNT(DISTINCT ae.session_id)::int
             FROM analytics_events ae JOIN posts p ON ae.post_id = p.id
            WHERE p.user_id = $1 AND p.status = 'published'
              AND ae.event_type = 'view'
              AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL) AS unique_visitors,
          (SELECT COUNT(DISTINCT ae.session_id)::int
             FROM analytics_events ae JOIN posts p ON ae.post_id = p.id
            WHERE p.user_id = $1
              AND ae.event_type = 'read_complete'
              AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL) AS total_reads
      `, [userId, days]),

      // ── Previous period — for growth % ──────────────────────────────────
      db.query(`
        SELECT
          (SELECT COUNT(DISTINCT ae.session_id)::int
             FROM analytics_events ae JOIN posts p ON ae.post_id = p.id
            WHERE p.user_id = $1 AND p.status = 'published'
              AND ae.event_type = 'view'
              AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL * 2
              AND ae.created_at <  NOW() - ($2 || ' days')::INTERVAL) AS prev_visitors,
          (SELECT COUNT(DISTINCT ae.session_id)::int
             FROM analytics_events ae JOIN posts p ON ae.post_id = p.id
            WHERE p.user_id = $1
              AND ae.event_type = 'read_complete'
              AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL * 2
              AND ae.created_at <  NOW() - ($2 || ' days')::INTERVAL) AS prev_reads
      `, [userId, days]),

      // ── Top posts — live, NOT stale materialized view ──────────────────
      db.query(`
        SELECT
          p.id, p.title, p.slug, p.view_count, p.reading_time_mins,
          COUNT(DISTINCT ae_r.session_id)::int AS total_reads,
          ROUND(COUNT(DISTINCT ae_r.session_id)::numeric /
                NULLIF(p.view_count, 0) * 100, 1)::float AS read_completion_rate
        FROM posts p
        LEFT JOIN analytics_events ae_r
               ON ae_r.post_id = p.id AND ae_r.event_type = 'read_complete'
        WHERE p.user_id = $1 AND p.status = 'published'
        GROUP BY p.id
        ORDER BY p.view_count DESC
        LIMIT 7
      `, [userId]),

      // ── Timeline — generate_series fills every day so chart has no gaps ─
      db.query(`
        WITH dates AS (
          SELECT generate_series(
            (NOW() - ($2 || ' days')::INTERVAL)::date,
            NOW()::date,
            '1 day'::INTERVAL
          )::date AS day
        ),
        events AS (
          SELECT
            DATE(ae.created_at) AS day,
            COUNT(DISTINCT ae.session_id) FILTER (WHERE ae.event_type = 'view')::int          AS views,
            COUNT(DISTINCT ae.session_id) FILTER (WHERE ae.event_type = 'read_complete')::int  AS reads
          FROM analytics_events ae
          JOIN posts p ON ae.post_id = p.id
          WHERE p.user_id = $1
            AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL
          GROUP BY DATE(ae.created_at)
        )
        SELECT
          TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
          COALESCE(e.views,  0)::int    AS views,
          COALESCE(e.reads,  0)::int    AS reads
        FROM dates d
        LEFT JOIN events e ON e.day = d.day
        ORDER BY d.day ASC
      `, [userId, days]),

      // ── Avg read completion ─────────────────────────────────────────────
      db.query(`
        SELECT ROUND(AVG(
          CASE WHEN v.cnt > 0
            THEN r.cnt::numeric / v.cnt * 100
            ELSE 0
          END
        ), 1)::float AS avg_completion_rate
        FROM (
          SELECT ae.post_id, COUNT(DISTINCT ae.session_id) AS cnt
          FROM analytics_events ae JOIN posts p ON ae.post_id = p.id
          WHERE p.user_id = $1 AND ae.event_type = 'view'
          GROUP BY ae.post_id
        ) v
        JOIN (
          SELECT ae.post_id, COUNT(DISTINCT ae.session_id) AS cnt
          FROM analytics_events ae JOIN posts p ON ae.post_id = p.id
          WHERE p.user_id = $1 AND ae.event_type = 'read_complete'
          GROUP BY ae.post_id
        ) r ON r.post_id = v.post_id
      `, [userId]),

      // ── Device breakdown ─────────────────────────────────────────────────
      db.query(`
        SELECT
          COALESCE(NULLIF(ae.device_type, ''), 'unknown') AS device_type,
          COUNT(DISTINCT ae.session_id)::int               AS count
        FROM analytics_events ae
        JOIN posts p ON ae.post_id = p.id
        WHERE p.user_id = $1
          AND ae.event_type = 'view'
          AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY device_type
        ORDER BY count DESC
      `, [userId, days]),

      // ── Top referrers ─────────────────────────────────────────────────────
      db.query(`
        SELECT
          COALESCE(NULLIF(ae.referrer, ''), 'Direct') AS referrer,
          COUNT(DISTINCT ae.session_id)::int           AS count
        FROM analytics_events ae
        JOIN posts p ON ae.post_id = p.id
        WHERE p.user_id = $1
          AND ae.event_type = 'view'
          AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 8
      `, [userId, days]),

      // ── Country breakdown ─────────────────────────────────────────────────
      db.query(`
        SELECT
          COALESCE(NULLIF(ae.country, ''), 'Unknown') AS country,
          COUNT(DISTINCT ae.session_id)::int           AS count
        FROM analytics_events ae
        JOIN posts p ON ae.post_id = p.id
        WHERE p.user_id = $1
          AND ae.event_type = 'view'
          AND ae.country IS NOT NULL
          AND ae.created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY ae.country
        ORDER BY count DESC
        LIMIT 8
      `, [userId, days]),
    ]);

  const cur  = overview.rows[0];
  const prev = prevPeriod.rows[0];

  const growth = (c, p) => p > 0 ? Math.round(((c - p) / p) * 100) : null;

  res.json({
    days,
    overview: {
      total_posts:     cur.total_posts,
      total_views:     cur.total_views,
      unique_visitors: cur.unique_visitors,
      total_reads:     cur.total_reads,
      growth: {
        visitors: growth(cur.unique_visitors, prev.prev_visitors),
        reads:    growth(cur.total_reads,     prev.prev_reads),
      },
    },
    topPosts:              topPosts.rows,
    viewsTimeline:         timeline.rows,
    avgReadCompletionRate: readCompletion.rows[0]?.avg_completion_rate || 0,
    deviceBreakdown:       devices.rows,
    referrerBreakdown:     referrers.rows,
    countryBreakdown:      countries.rows,
  });
});

export const getPostAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const days    = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

  const post = await db.query(
    'SELECT id FROM posts WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  if (!post.rows[0]) return res.status(404).json({ error: 'Post not found' });

  const [summary, timeline, devices, referrers] = await Promise.all([
    // Live summary — not stale materialized view
    db.query(`
      SELECT
        p.view_count                                    AS total_views,
        COUNT(DISTINCT ae_r.session_id)::int            AS total_reads,
        ROUND(COUNT(DISTINCT ae_r.session_id)::numeric /
              NULLIF(p.view_count, 0) * 100, 1)::float  AS read_completion_rate
      FROM posts p
      LEFT JOIN analytics_events ae_r ON ae_r.post_id = p.id AND ae_r.event_type = 'read_complete'
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]),

    // Gap-filled timeline
    db.query(`
      WITH dates AS (
        SELECT generate_series(
          (NOW() - ($2 || ' days')::INTERVAL)::date,
          NOW()::date,
          '1 day'::INTERVAL
        )::date AS day
      ),
      events AS (
        SELECT
          DATE(created_at) AS day,
          COUNT(*) FILTER (WHERE event_type = 'view')::int          AS views,
          COUNT(*) FILTER (WHERE event_type = 'read_complete')::int  AS reads
        FROM analytics_events
        WHERE post_id = $1
          AND created_at >= NOW() - ($2 || ' days')::INTERVAL
        GROUP BY DATE(created_at)
      )
      SELECT
        TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
        COALESCE(e.views, 0)::int     AS views,
        COALESCE(e.reads, 0)::int     AS reads
      FROM dates d
      LEFT JOIN events e ON e.day = d.day
      ORDER BY d.day ASC
    `, [id, days]),

    db.query(`
      SELECT
        COALESCE(NULLIF(device_type, ''), 'unknown') AS device_type,
        COUNT(DISTINCT session_id)::int               AS count
      FROM analytics_events
      WHERE post_id = $1 AND event_type = 'view'
      GROUP BY device_type ORDER BY count DESC
    `, [id]),

    db.query(`
      SELECT
        COALESCE(NULLIF(referrer, ''), 'Direct') AS referrer,
        COUNT(DISTINCT session_id)::int           AS count
      FROM analytics_events
      WHERE post_id = $1 AND event_type = 'view'
      GROUP BY referrer ORDER BY count DESC LIMIT 10
    `, [id]),
  ]);

  res.json({
    summary:   summary.rows[0]  || {},
    timeline:  timeline.rows,
    devices:   devices.rows,
    referrers: referrers.rows,
  });
});

export const getSearchInsights = asyncHandler(async (req, res) => {
  const [topQueries, zeroResults] = await Promise.all([
    db.query(`
      SELECT query, COUNT(*)::int AS count, ROUND(AVG(results_count), 1)::float AS avg_results
      FROM search_queries
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY query ORDER BY count DESC LIMIT 20
    `),
    db.query(`
      SELECT query, COUNT(*)::int AS count
      FROM search_queries WHERE results_count = 0
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY query ORDER BY count DESC LIMIT 10
    `),
  ]);

  res.json({
    topQueries:        topQueries.rows,
    zeroResultQueries: zeroResults.rows,
  });
});
