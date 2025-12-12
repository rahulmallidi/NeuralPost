import { asyncHandler } from '../middleware/errorHandler.js';
import { suggestTags as aiSuggestTags, generateExcerpt as aiGenerateExcerpt, writingAssist as aiWritingAssist, generatePost as aiGeneratePost } from '../services/aiService.js';
import { marked } from 'marked';
import db from '../config/db.js';

export const suggestTags = asyncHandler(async (req, res) => {
  const { content, title = '' } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  const tags = await aiSuggestTags(title, content);
  res.json({ tags });
});

export const generateExcerpt = asyncHandler(async (req, res) => {
  const { content, title } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  const excerpt = await aiGenerateExcerpt(content, title);
  res.json({ excerpt });
});

export const writingAssist = asyncHandler(async (req, res) => {
  const { text, instruction } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  const improved = await aiWritingAssist(text, instruction);
  res.json({ result: improved });
});

export const generatePost = asyncHandler(async (req, res) => {
  const { topic, tone, length, wordCount } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });
  const post = await aiGeneratePost(topic.trim(), tone, length, wordCount);
  // Convert markdown content to HTML so TipTap renders it with correct formatting
  if (post.content) {
    post.content_html = marked(post.content);
  }
  res.json(post);
});

export const trendingTopics = asyncHandler(async (req, res) => {
  // Get top tags from the last 7 days based on published posts
  const result = await db.query(`
    SELECT t.name, t.slug, COUNT(pt.post_id) AS post_count
    FROM tags t
    JOIN post_tags pt ON t.id = pt.tag_id
    JOIN posts p ON pt.post_id = p.id
    WHERE p.status = 'published' AND p.published_at >= NOW() - INTERVAL '7 days'
    GROUP BY t.id ORDER BY post_count DESC LIMIT 10
  `);
  res.json(result.rows);
});
