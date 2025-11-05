import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db.js';
import redisConnection from '../config/redis.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import slugify from 'slugify';

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

export const register = asyncHandler(async (req, res) => {
  const { email, username, password, blogName } = req.body;

  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email or username already taken' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const blogSlug = slugify(blogName || username, { lower: true, strict: true });

  const result = await db.query(
    `INSERT INTO users (email, username, password_hash, blog_name, blog_slug)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, blog_name, blog_slug, role, created_at`,
    [email, username, passwordHash, blogName || `${username}'s Blog`, blogSlug]
  );

  const user = result.rows[0];
  const tokens = generateTokens({ id: user.id, email: user.email, username: user.username, role: user.role });

  // Store refresh token in Redis
  await redisConnection.setex(`refresh:${user.id}`, 7 * 24 * 3600, tokens.refreshToken);

  res.status(201).json({ user, ...tokens });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = { id: user.id, email: user.email, username: user.username, role: user.role };
  const tokens = generateTokens(payload);

  await redisConnection.setex(`refresh:${user.id}`, 7 * 24 * 3600, tokens.refreshToken);

  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, ...tokens });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }

  const stored = await redisConnection.get(`refresh:${decoded.id}`);
  if (stored !== refreshToken) {
    return res.status(403).json({ error: 'Refresh token revoked' });
  }

  const tokens = generateTokens({ id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role });
  await redisConnection.setex(`refresh:${decoded.id}`, 7 * 24 * 3600, tokens.refreshToken);

  res.json(tokens);
});

export const logout = asyncHandler(async (req, res) => {
  await redisConnection.del(`refresh:${req.user.id}`);
  res.json({ message: 'Logged out successfully' });
});

export const getMe = asyncHandler(async (req, res) => {
  const result = await db.query(
    'SELECT id, email, username, role, blog_name, blog_slug, avatar_url, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});
