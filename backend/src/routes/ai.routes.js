import express from 'express';
import { suggestTags, generateExcerpt, writingAssist, trendingTopics } from '../controllers/ai.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/suggest-tags', authenticateToken, apiLimiter, suggestTags);
router.post('/generate-excerpt', authenticateToken, apiLimiter, generateExcerpt);
router.post('/writing-assist', authenticateToken, apiLimiter, writingAssist);
router.get('/trending-topics', trendingTopics);

export default router;
