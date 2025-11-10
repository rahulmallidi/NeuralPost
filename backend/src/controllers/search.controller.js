import { asyncHandler } from '../middleware/errorHandler.js';
import { hybridSearch, semanticSearch as semSearch, keywordSearch as kwSearch, getRelatedPosts } from '../services/searchService.js';
import db from '../config/db.js';

export const semanticSearch = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  await db.query(
    'INSERT INTO search_queries (query, results_count) VALUES ($1, $2)',
    [q, 0]
  ).catch(() => {}); // fire-and-forget log

  const results = await semSearch(q, Number(limit));
  res.json({ query: q, results });
});

export const keywordSearch = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  const results = await kwSearch(q, Number(limit));
  res.json({ query: q, results });
});

export const hybridSearch = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  // Log search query
  const results = await hybridSearch(q, Number(limit));

  await db.query(
    'INSERT INTO search_queries (query, results_count) VALUES ($1, $2)',
    [q, results.length]
  ).catch(() => {});

  res.json({ query: q, results });
});

export const relatedPosts = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { limit = 5 } = req.query;
  const results = await getRelatedPosts(postId, Number(limit));
  res.json(results);
});
