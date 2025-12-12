import { asyncHandler } from '../middleware/errorHandler.js';
import { hybridSearch as hybridSearchService, semanticSearch as semSearch, keywordSearch as kwSearch, getRelatedPosts } from '../services/searchService.js';
import db from '../config/db.js';
import redis from '../config/redis.js';

// Cache TTL (seconds). Hot queries are served from Redis in < 5ms.
const SEARCH_CACHE_TTL = 300; // 5 minutes
const RELATED_CACHE_TTL = 600; // 10 minutes — related posts change less frequently

/**
 * Build a deterministic Redis cache key for a search query.
 * Normalized: lowercase + trimmed so 'React' and 'react' share the same entry.
 */
function searchCacheKey(type, q, limit) {
  return `search:${type}:${q.toLowerCase().trim()}:${limit}`;
}

/**
 * Wraps a search function with Redis caching + X-Response-Time header.
 * Cache hit → < 5ms. Cache miss → DB/vector query + populate cache.
 */
async function cachedSearch(res, cacheKey, ttl, searchFn) {
  const start = Date.now();

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const elapsed = Date.now() - start;
      res.set('X-Response-Time', `${elapsed}ms`);
      res.set('X-Cache', 'HIT');
      return JSON.parse(cached);
    }
  } catch (_) { /* Redis unavailable — fall through to DB */ }

  const results = await searchFn();
  const elapsed = Date.now() - start;

  res.set('X-Response-Time', `${elapsed}ms`);
  res.set('X-Cache', 'MISS');

  if (elapsed > 200) {
    console.warn(`[search] Slow query (${elapsed}ms): ${cacheKey}`);
  }

  // Cache asynchronously — don't block the response
  redis.setex(cacheKey, ttl, JSON.stringify(results)).catch(() => {});

  return results;
}

export const semanticSearch = asyncHandler(async (req, res) => {
  const { q, limit = 100 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  const key = searchCacheKey('semantic', q, limit);
  const results = await cachedSearch(res, key, SEARCH_CACHE_TTL, () => semSearch(q, Number(limit)));

  // Fire-and-forget search log (only on cache miss to avoid inflating counts)
  if (res.get('X-Cache') === 'MISS') {
    db.query('INSERT INTO search_queries (query, results_count) VALUES ($1, $2)', [q, results.length])
      .catch(() => {});
  }

  res.json({ query: q, results });
});

export const keywordSearch = asyncHandler(async (req, res) => {
  const { q, limit = 100 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  const key = searchCacheKey('keyword', q, limit);
  const results = await cachedSearch(res, key, SEARCH_CACHE_TTL, () => kwSearch(q, Number(limit)));

  res.json({ query: q, results });
});

export const hybridSearch = asyncHandler(async (req, res) => {
  const { q, limit = 100 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  const key = searchCacheKey('hybrid', q, limit);
  const results = await cachedSearch(res, key, SEARCH_CACHE_TTL, () => hybridSearchService(q, Number(limit)));

  if (res.get('X-Cache') === 'MISS') {
    db.query('INSERT INTO search_queries (query, results_count) VALUES ($1, $2)', [q, results.length])
      .catch(() => {});
  }

  res.json({ query: q, results });
});

export const relatedPosts = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { limit = 5 } = req.query;

  const key = `related:${postId}:${limit}`;
  const results = await cachedSearch(res, key, RELATED_CACHE_TTL, () => getRelatedPosts(postId, Number(limit)));

  res.json(results);
});
