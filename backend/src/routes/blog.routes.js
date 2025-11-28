import express from 'express';
import { getBlogMeta, getBlogPosts, getBlogFeed } from '../controllers/blog.controller.js';

const router = express.Router();

router.get('/:blogSlug', getBlogMeta);
router.get('/:blogSlug/posts', getBlogPosts);
router.get('/:blogSlug/feed.xml', getBlogFeed);

export default router;
