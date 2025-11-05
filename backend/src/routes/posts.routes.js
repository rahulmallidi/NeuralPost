import express from 'express';
import {
  listPosts, getPost, createPost, updatePost, deletePost,
  publishPost, getDrafts, getPostComments, addComment,
} from '../controllers/posts.controller.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validateBody.js';
import { z } from 'zod';

const router = express.Router();

export const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  tags: z.array(z.string()).max(10).default([]),
});

export const updatePostSchema = createPostSchema.partial();

router.get('/', optionalAuth, listPosts);
router.get('/my/drafts', authenticateToken, getDrafts);
router.get('/:slug', optionalAuth, getPost);
router.post('/', authenticateToken, validateBody(createPostSchema), createPost);
router.put('/:id', authenticateToken, validateBody(updatePostSchema), updatePost);
router.delete('/:id', authenticateToken, deletePost);
router.post('/:id/publish', authenticateToken, publishPost);
router.get('/:id/comments', getPostComments);
router.post('/:id/comments', authenticateToken, addComment);

export default router;
