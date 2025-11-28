import db from '../config/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { queueEmbeddingGeneration } from '../jobs/embeddingQueue.js';
import slugify from 'slugify';
import { marked } from 'marked';

function calcReadingTime(text) {
  const wordsPerMin = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMin);
}

export const listPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, tag, author, status = 'published' } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           p.view_count, p.published_at, p.created_at,
           u.username, u.blog_slug, u.avatar_url,
           COALESCE(json_agg(DISTINCT jsonb_build_object('name', t.name, 'slug', t.slug))
             FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.status = $1
  `;
  const params = [status];
  let idx = 2;

  if (tag) {
    query += ` AND EXISTS (
      SELECT 1 FROM post_tags pt2 JOIN tags t2 ON pt2.tag_id = t2.id
      WHERE pt2.post_id = p.id AND t2.slug = $${idx}
    )`;
    params.push(tag); idx++;
  }
  if (author) {
    query += ` AND u.username = $${idx}`;
    params.push(author); idx++;
  }

  query += ` GROUP BY p.id, u.id ORDER BY p.published_at DESC NULLS LAST LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  const countResult = await db.query('SELECT COUNT(*) FROM posts WHERE status = $1', [status]);

  res.json({
    posts: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  });
});

export const getPost = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const result = await db.query(`
    SELECT p.*, u.username, u.blog_name, u.blog_slug, u.avatar_url,
           COALESCE(json_agg(DISTINCT jsonb_build_object('name', t.name, 'slug', t.slug))
             FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.slug = $1 AND (p.status = 'published' OR p.user_id = $2)
    GROUP BY p.id, u.id
  `, [slug, req.user?.id || null]);

  if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });

  // Increment view count (fire and forget)
  db.query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [result.rows[0].id]);

  res.json(result.rows[0]);
});

export const createPost = asyncHandler(async (req, res) => {
  const { title, content, excerpt, coverImageUrl, status, tags } = req.body;

  const slug = slugify(title, { lower: true, strict: true });
  const contentHtml = marked(content);
  const readingTime = calcReadingTime(content);

  const result = await db.query(`
    INSERT INTO posts (user_id, title, slug, content, content_html, excerpt, cover_image_url, status, reading_time_mins, published_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    req.user.id, title, slug, content, contentHtml,
    excerpt || null, coverImageUrl || null, status, readingTime,
    status === 'published' ? new Date() : null,
  ]);

  const post = result.rows[0];

  // Handle tags
  if (tags && tags.length > 0) {
    await upsertPostTags(post.id, tags);
  }

  // Queue async embedding generation
  await queueEmbeddingGeneration(post.id, `${title} ${content}`);

  res.status(201).json(post);
});

export const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, excerpt, coverImageUrl, status, tags } = req.body;

  const existing = await db.query('SELECT * FROM posts WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Post not found or not authorized' });

  const contentHtml = content ? marked(content) : existing.rows[0].content_html;
  const readingTime = content ? calcReadingTime(content) : existing.rows[0].reading_time_mins;
  const slug = title ? slugify(title, { lower: true, strict: true }) : existing.rows[0].slug;

  const result = await db.query(`
    UPDATE posts SET title = COALESCE($1, title), slug = $2, content = COALESCE($3, content),
      content_html = $4, excerpt = COALESCE($5, excerpt), cover_image_url = COALESCE($6, cover_image_url),
      status = COALESCE($7, status), reading_time_mins = $8, updated_at = NOW()
    WHERE id = $9 AND user_id = $10 RETURNING *
  `, [title, slug, content, contentHtml, excerpt, coverImageUrl, status, readingTime, id, req.user.id]);

  if (tags) await upsertPostTags(id, tags);
  if (content || title) await queueEmbeddingGeneration(id, `${result.rows[0].title} ${result.rows[0].content}`);

  res.json(result.rows[0]);
});

export const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await db.query('DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Post not found or not authorized' });
  res.json({ message: 'Post deleted' });
});

export const publishPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await db.query(`
    UPDATE posts SET status = 'published', published_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2 AND status = 'draft' RETURNING *
  `, [id, req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Draft not found' });
  res.json(result.rows[0]);
});

export const getDrafts = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT id, title, slug, excerpt, cover_image_url, reading_time_mins, created_at, updated_at
     FROM posts WHERE user_id = $1 AND status = 'draft' ORDER BY updated_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

export const getPostComments = asyncHandler(async (req, res) => {
  const result = await db.query(`
    SELECT c.*, u.username, u.avatar_url FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = $1 AND c.parent_id IS NULL
    ORDER BY c.created_at ASC
  `, [req.params.id]);
  res.json(result.rows);
});

export const addComment = asyncHandler(async (req, res) => {
  const { content, parentId } = req.body;
  const result = await db.query(
    'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.params.id, req.user.id, content, parentId || null]
  );
  res.status(201).json(result.rows[0]);
});

async function upsertPostTags(postId, tags) {
  await db.query('DELETE FROM post_tags WHERE post_id = $1', [postId]);
  for (const tagName of tags) {
    const slug = slugify(tagName, { lower: true, strict: true });
    const tag = await db.query(
      'INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [tagName, slug]
    );
    await db.query(
      'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [postId, tag.rows[0].id]
    );
  }
}
