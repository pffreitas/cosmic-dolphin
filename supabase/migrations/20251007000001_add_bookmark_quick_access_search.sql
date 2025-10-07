CREATE EXTENSION IF NOT EXISTS pgroonga;

-- Add quick_access column to bookmarks table
-- This column will store brief and relevant information about bookmarks for search
ALTER TABLE
    bookmarks
ADD
    COLUMN quick_access text;

-- Create PGroonga index for full-text search on quick_access column
CREATE INDEX IF NOT EXISTS ix_bookmarks_quick_access ON bookmarks USING pgroonga(quick_access);

COMMENT ON COLUMN bookmarks.quick_access IS 'Combined searchable text containing link, title, and keywords for quick access search using PGroonga full-text search';