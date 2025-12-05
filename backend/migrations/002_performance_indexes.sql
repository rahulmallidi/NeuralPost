-- Migration 002: Performance indexes

-- Fast single-post lookup by slug (used on every post page visit)
CREATE INDEX IF NOT EXISTS posts_slug_idx ON posts (slug);

-- Covering index for the DISTINCT ON (slug) deduplication subquery
-- that runs on every browse/search request
CREATE INDEX IF NOT EXISTS posts_dedup_idx ON posts (slug, status, published_at DESC, id DESC);

-- Main browse query ORDER BY: status + published_at + id
CREATE INDEX IF NOT EXISTS posts_status_published_id ON posts (status, published_at DESC, id DESC);

-- Full-text search: separate indexes on title and content for faster ts_rank
CREATE INDEX IF NOT EXISTS posts_title_fts ON posts USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS posts_content_fts ON posts USING gin(to_tsvector('english', content));

-- Username join used in every search query and post listing
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);

-- Blog slug for blog page lookups
CREATE INDEX IF NOT EXISTS users_blog_slug_idx ON users (blog_slug);

-- Reverse direction on post_tags for tag-filter EXISTS subquery
CREATE INDEX IF NOT EXISTS post_tags_tag_id_idx ON post_tags (tag_id);

-- Analytics events by post for dashboard queries
CREATE INDEX IF NOT EXISTS analytics_events_post_type ON analytics_events (post_id, event_type);

-- View count update by id (fire-and-forget UPDATE on every post view)
CREATE INDEX IF NOT EXISTS posts_id_viewcount ON posts (id) INCLUDE (view_count);
