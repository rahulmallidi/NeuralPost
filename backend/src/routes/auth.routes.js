import express from 'express';
import { register, login, refresh, logout, getMe } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { z } from 'zod';

const router = express.Router();

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  blogName: z.string().min(2).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getMe);

export default router;
