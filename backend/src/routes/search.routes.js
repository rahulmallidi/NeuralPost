import express from 'express';
import { semanticSearch, keywordSearch, hybridSearch, relatedPosts } from '../controllers/search.controller.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/semantic', searchLimiter, semanticSearch);
router.get('/keyword', searchLimiter, keywordSearch);
router.get('/hybrid', searchLimiter, hybridSearch);
router.get('/related/:postId', relatedPosts);

export default router;
