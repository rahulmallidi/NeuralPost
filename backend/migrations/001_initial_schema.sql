-- Migration 001: Initial schema
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (multi-tenant: each user = a blog "tenant")
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'author',
  blog_name TEXT,
  blog_slug TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  excerpt TEXT,
  cover_image_url TEXT,
  status TEXT DEFAULT 'draft',
  embedding VECTOR(384),
  reading_time_mins INT,
  view_count INT DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES comments(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  session_id TEXT,
  referrer TEXT,
  country TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search Queries Log
CREATE TABLE IF NOT EXISTS search_queries (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INT,
  clicked_post_id UUID REFERENCES posts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS posts_embedding_hnsw ON posts USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS posts_user_status_published ON posts (user_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_post_created ON analytics_events (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_created ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_full_text ON posts USING gin(to_tsvector('english', title || ' ' || content));

-- Materialized view for fast analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS post_analytics_summary AS
SELECT
  post_id,
  COUNT(*) FILTER (WHERE event_type = 'view') AS total_views,
  COUNT(*) FILTER (WHERE event_type = 'read_complete') AS total_reads,
  COUNT(*) FILTER (WHERE event_type = 'share') AS total_shares,
  COUNT(DISTINCT session_id) AS unique_visitors,
  ROUND(
    COUNT(*) FILTER (WHERE event_type = 'read_complete')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE event_type = 'view'), 0) * 100, 2
  ) AS read_completion_rate
FROM analytics_events
GROUP BY post_id;

CREATE UNIQUE INDEX IF NOT EXISTS post_analytics_summary_post_id ON post_analytics_summary (post_id);
