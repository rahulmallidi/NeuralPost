import express from 'express';
import { trackEvent, getDashboard, getPostAnalytics, getSearchInsights } from '../controllers/analytics.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/event', trackEvent);
router.get('/dashboard', authenticateToken, getDashboard);
router.get('/post/:id', authenticateToken, getPostAnalytics);
router.get('/search-insights', authenticateToken, getSearchInsights);

export default router;
