-- Add quick_access column and PGroonga full-text search support for bookmarks
-- Enable PGroonga extension (if not already enabled)
-- Note: In test environment, pgroonga might not be available, so we'll handle it gracefully
DO $ $ BEGIN -- Try to create pgroonga extension in public schema (standard PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgroonga;

EXCEPTION
WHEN OTHERS THEN -- If pgroonga is not available, raise a notice but continue
RAISE NOTICE 'pgroonga extension not available (skipped for testing): %',
SQLERRM;

END $ $;

-- Add quick_access column to bookmarks table
-- This column will store brief and relevant information about bookmarks for search
ALTER TABLE
    bookmarks
ADD
    COLUMN quick_access text;

-- Create PGroonga index for full-text search on quick_access column
-- Note: This will fail gracefully if pgroonga is not available
DO $ $ BEGIN -- Try to create pgroonga index
CREATE INDEX IF NOT EXISTS ix_bookmarks_quick_access ON bookmarks USING pgroonga(quick_access);

RAISE NOTICE 'Created PGroonga index for quick_access search';

EXCEPTION
WHEN OTHERS THEN -- If pgroonga index creation fails, create a regular text index as fallback
RAISE NOTICE 'PGroonga index failed, creating regular text index: %',
SQLERRM;

CREATE INDEX IF NOT EXISTS ix_bookmarks_quick_access ON bookmarks USING gin(to_tsvector('english', quick_access));

END $ $;

-- Add comment to document the purpose of the column
COMMENT ON COLUMN bookmarks.quick_access IS 'Combined searchable text containing link, title, and keywords for quick access search using PGroonga full-text search';