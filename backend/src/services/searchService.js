import db from '../config/db.js';
import { generateEmbedding } from './embeddingService.js';

export async function semanticSearch(query, limit = 10) {
  const embedding = await generateEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  const result = await db.query(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           p.published_at, u.username, u.blog_slug,
           1 - (p.embedding <=> $1::vector) AS similarity_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'published' AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> $1::vector
    LIMIT $2
  `, [vectorStr, limit]);

  return result.rows;
}

export async function keywordSearch(query, limit = 10) {
  const result = await db.query(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           p.published_at, u.username, u.blog_slug,
           ts_rank(to_tsvector('english', p.title || ' ' || p.content), plainto_tsquery('english', $1)) AS relevance_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'published'
      AND to_tsvector('english', p.title || ' ' || p.content) @@ plainto_tsquery('english', $1)
    ORDER BY relevance_score DESC
    LIMIT $2
  `, [query, limit]);

  return result.rows;
}

export async function hybridSearch(query, limit = 10) {
  const embedding = await generateEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  const result = await db.query(`
    WITH semantic AS (
      SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
             p.published_at, u.username, u.blog_slug,
             1 - (p.embedding <=> $1::vector) AS score,
             ROW_NUMBER() OVER (ORDER BY p.embedding <=> $1::vector) AS rank
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published' AND p.embedding IS NOT NULL
      LIMIT 20
    ),
    fulltext AS (
      SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
             p.published_at, u.username, u.blog_slug,
             ts_rank(to_tsvector('english', p.title || ' ' || p.content), plainto_tsquery('english', $2)) AS score,
             ROW_NUMBER() OVER (
               ORDER BY ts_rank(to_tsvector('english', p.title || ' ' || p.content), plainto_tsquery('english', $2)) DESC
             ) AS rank
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
        AND to_tsvector('english', p.title || ' ' || p.content) @@ plainto_tsquery('english', $2)
      LIMIT 20
    ),
    rrf AS (
      SELECT
        COALESCE(s.id, f.id) AS id,
        COALESCE(s.title, f.title) AS title,
        COALESCE(s.slug, f.slug) AS slug,
        COALESCE(s.excerpt, f.excerpt) AS excerpt,
        COALESCE(s.cover_image_url, f.cover_image_url) AS cover_image_url,
        COALESCE(s.reading_time_mins, f.reading_time_mins) AS reading_time_mins,
        COALESCE(s.published_at, f.published_at) AS published_at,
        COALESCE(s.username, f.username) AS username,
        COALESCE(s.blog_slug, f.blog_slug) AS blog_slug,
        (COALESCE(1.0/(60 + s.rank), 0) + COALESCE(1.0/(60 + f.rank), 0)) AS rrf_score
      FROM semantic s
      FULL OUTER JOIN fulltext f ON s.id = f.id
    )
    SELECT * FROM rrf ORDER BY rrf_score DESC LIMIT $3
  `, [vectorStr, query, limit]);

  return result.rows;
}

export async function getRelatedPosts(postId, limit = 5) {
  const post = await db.query(
    'SELECT embedding FROM posts WHERE id = $1',
    [postId]
  );

  if (!post.rows[0] || !post.rows[0].embedding) return [];

  const embedding = post.rows[0].embedding;

  const result = await db.query(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           u.username, u.blog_slug,
           1 - (p.embedding <=> $1::vector) AS similarity_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'published' AND p.id != $2 AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> $1::vector
    LIMIT $3
  `, [embedding, postId, limit]);

  return result.rows;
}
