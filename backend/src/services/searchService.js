import db from '../config/db.js';
import { generateEmbedding } from './embeddingService.js';

/** Log query timing and warn if it exceeds the SLA threshold */
function logTiming(label, ms) {
  const flag = ms > 200 ? '⚠️  SLOW' : '✅';
  console.log(`[search] ${flag} ${label}: ${ms}ms`);
}

export async function semanticSearch(query, limit = 100) {
  let embedding;
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    console.warn('Embedding failed, falling back to keyword search:', err.message);
    return keywordSearch(query, limit);
  }
  const vectorStr = `[${embedding.join(',')}]`;

  // If no posts have embeddings yet, use keyword search
  const embCount = await db.query('SELECT 1 FROM posts WHERE embedding IS NOT NULL LIMIT 1');
  if (embCount.rows.length === 0) return keywordSearch(query, limit);

  const t0 = Date.now();
  const result = await db.query(`
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           p.published_at, u.username, u.blog_slug,
           1 - (p.embedding <=> $1::vector) AS similarity_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'published' AND p.embedding IS NOT NULL
      AND p.id IN (
        SELECT DISTINCT ON (slug) id FROM posts
        WHERE status = 'published'
        ORDER BY slug, published_at DESC, id DESC
      )
    ORDER BY p.embedding <=> $1::vector
    LIMIT $2
  `, [vectorStr, limit]);
  logTiming('semantic HNSW query', Date.now() - t0);

  if (result.rows.length < 5) return keywordSearch(query, limit);
  return result.rows;
}

export async function keywordSearch(query, limit = 100) {
  const t0 = Date.now();
  const result = await db.query(`
    WITH dedup AS (
      SELECT DISTINCT ON (slug) id FROM posts
      WHERE status = 'published'
      ORDER BY slug, published_at DESC, id DESC
    )
    SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
           p.published_at, u.username, u.blog_slug,
           ts_rank(p.tsv, plainto_tsquery('english', $1)) AS relevance_score
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'published'
      AND p.id IN (SELECT id FROM dedup)
      AND p.tsv @@ plainto_tsquery('english', $1)
    ORDER BY relevance_score DESC, p.published_at DESC, p.id DESC
    LIMIT $2
  `, [query, limit]);
  logTiming('keyword GIN query', Date.now() - t0);

  return result.rows;
}

export async function hybridSearch(query, limit = 100) {
  let embedding;
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    console.warn('Embedding failed, falling back to keyword search:', err.message);
    return keywordSearch(query, limit);
  }
  const vectorStr = `[${embedding.join(',')}]`;

  // If no posts have embeddings, skip vector path entirely
  const embCount = await db.query('SELECT 1 FROM posts WHERE embedding IS NOT NULL LIMIT 1');
  if (embCount.rows.length === 0) return keywordSearch(query, limit);

  const t0 = Date.now();
  const result = await db.query(`
    WITH dedup AS (
      SELECT DISTINCT ON (slug) id FROM posts
      WHERE status = 'published'
      ORDER BY slug, published_at DESC, id DESC
    ),
    semantic AS (
      SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
             p.published_at, u.username, u.blog_slug,
             1 - (p.embedding <=> $1::vector) AS score,
             ROW_NUMBER() OVER (ORDER BY p.embedding <=> $1::vector) AS rank
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published' AND p.embedding IS NOT NULL AND p.id IN (SELECT id FROM dedup)
      LIMIT 100
    ),
    fulltext AS (
      SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image_url, p.reading_time_mins,
             p.published_at, u.username, u.blog_slug,
             ts_rank(p.tsv, plainto_tsquery('english', $2)) AS score,
             ROW_NUMBER() OVER (
               ORDER BY ts_rank(p.tsv, plainto_tsquery('english', $2)) DESC
             ) AS rank
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
        AND p.id IN (SELECT id FROM dedup)
        AND p.tsv @@ plainto_tsquery('english', $2)
      LIMIT 100
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
    SELECT * FROM rrf ORDER BY rrf_score DESC, published_at DESC, id DESC LIMIT $3
  `, [vectorStr, query, limit]);
  logTiming('hybrid RRF query (DB portion)', Date.now() - t0);

  return result.rows;
}

export async function getRelatedPosts(postId, limit = 5) {
  const post = await db.query(
    'SELECT embedding FROM posts WHERE id = $1',
    [postId]
  );

  if (!post.rows[0] || !post.rows[0].embedding) return [];

  const embedding = post.rows[0].embedding;

  const t0 = Date.now();
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
  logTiming('related posts HNSW query', Date.now() - t0);

  return result.rows;
}
