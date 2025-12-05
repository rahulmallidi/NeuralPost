-- Migration 003: Stored tsvector column for fast ts_rank
--
-- Problem: ts_rank(to_tsvector('english', title) || to_tsvector('english', content), ...)
-- re-computes to_tsvector for every matched row at query time. On broad queries that match
-- many posts (e.g. "machine learning") this adds significant CPU overhead.
--
-- Solution: Add a stored GENERATED column that pre-computes and persists the combined
-- tsvector. PostgreSQL updates it automatically on INSERT/UPDATE.
-- ts_rank can then read the pre-computed value instead of recomputing.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(content, '')
    )
  ) STORED;

-- Single GIN index on the stored column — replaces the two separate column expression indexes
-- for ts_rank purposes (the separate title/content indexes still help the @@ WHERE clause)
CREATE INDEX IF NOT EXISTS posts_tsv_gin ON posts USING gin(tsv);
