-- Add quick_access column and PGroonga full-text search support for bookmarks
-- Enable PGroonga extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA extensions;

-- Add quick_access column to bookmarks table
-- This column will store brief and relevant information about bookmarks for search
ALTER TABLE
    bookmarks
ADD
    COLUMN quick_access text;

-- Create PGroonga index for full-text search on quick_access column
CREATE INDEX ix_bookmarks_quick_access ON bookmarks USING pgroonga(quick_access);

-- Add comment to document the purpose of the column
COMMENT ON COLUMN bookmarks.quick_access IS 'Combined searchable text containing link, title, and keywords for quick access search using PGroonga full-text search';