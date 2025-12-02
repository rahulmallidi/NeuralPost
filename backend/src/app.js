import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { validateEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import postsRoutes from './routes/posts.routes.js';
import searchRoutes from './routes/search.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import aiRoutes from './routes/ai.routes.js';
import blogRoutes from './routes/blog.routes.js';
import adminRoutes from './routes/admin.routes.js';

validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & utility middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Health check — available at both /health (Docker) and /api/health (Railway)
const healthHandler = async (req, res) => {
  try {
    await import('./config/db.js').then(m => m.default.query('SELECT 1'));
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'degraded', timestamp: new Date().toISOString() });
  }
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use(errorHandler);

export default app;

// ── GIN index warmup ────────────────────────────────────────────────────────
// Pre-fetches common search terms on startup so the first real user query hits
// already-cached index pages rather than paying the cold-start penalty.
async function warmGinIndex() {
  try {
    const { default: db } = await import('./config/db.js');
    const terms = ['machine learning', 'javascript', 'react', 'python', 'cloud'];
    await Promise.all(
      terms.map(term =>
        db.query(
          `SELECT count(*) FROM posts WHERE tsv @@ plainto_tsquery('english', $1)`,
          [term]
        )
      )
    );
    console.log('✅ GIN index warmed for common search terms');
  } catch (err) {
    console.warn('⚠️  GIN warmup failed (non-fatal):', err.message);
  }
}

// Only start the HTTP server when run directly (not imported by tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 NeuralPost server running on port ${PORT}`);
    warmGinIndex();
  });
}
