import db from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getBlogMeta = asyncHandler(async (req, res) => {
  const { blogSlug } = req.params;

  const result = await db.query(
    'SELECT id, username, blog_name, blog_slug, avatar_url, created_at FROM users WHERE blog_slug = $1',
    [blogSlug]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Blog not found' });

  const stats = await db.query(`
    SELECT COUNT(*) AS post_count, SUM(view_count) AS total_views
    FROM posts WHERE user_id = $1 AND status = 'published'
  `, [result.rows[0].id]);

  res.json({ ...result.rows[0], stats: stats.rows[0] });
});

export const getBlogPosts = asyncHandler(async (req, res) => {
  const { blogSlug } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const user = await db.query('SELECT id FROM users WHERE blog_slug = $1', [blogSlug]);
  if (!user.rows[0]) return res.status(404).json({ error: 'Blog not found' });

  const result = await db.query(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           p.view_count, p.published_at,
           COALESCE(json_agg(DISTINCT jsonb_build_object('name', t.name, 'slug', t.slug))
             FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.user_id = $1 AND p.status = 'published'
    GROUP BY p.id ORDER BY p.published_at DESC
    LIMIT $2 OFFSET $3
  `, [user.rows[0].id, limit, offset]);

  res.json(result.rows);
});

export const getBlogFeed = asyncHandler(async (req, res) => {
  const { blogSlug } = req.params;

  const user = await db.query(
    'SELECT id, username, blog_name FROM users WHERE blog_slug = $1',
    [blogSlug]
  );
  if (!user.rows[0]) return res.status(404).json({ error: 'Blog not found' });

  const posts = await db.query(`
    SELECT title, slug, excerpt, published_at, content_html
    FROM posts WHERE user_id = $1 AND status = 'published'
    ORDER BY published_at DESC LIMIT 20
  `, [user.rows[0].id]);

  const siteUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const u = user.rows[0];

  const items = posts.rows.map(p => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${siteUrl}/blog/${blogSlug}/${p.slug}</link>
      <description><![CDATA[${p.excerpt || ''}]]></description>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <content:encoded><![CDATA[${p.content_html || ''}]]></content:encoded>
    </item>
  `).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${u.blog_name}</title>
    <link>${siteUrl}/blog/${blogSlug}</link>
    <description>${u.blog_name} on NeuralPost</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml');
  res.send(rss);
});
