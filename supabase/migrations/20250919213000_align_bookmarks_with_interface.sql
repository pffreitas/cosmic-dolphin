-- Migration to align bookmarks table with TypeScript interface
-- This migration migrates data and removes unused columns (cosmic columns already exist)
-- Migrate existing data to cosmic columns
-- Move summary to cosmic_summary (if cosmic_summary is empty and summary has data)
UPDATE
    bookmarks
SET
    cosmic_summary = summary
WHERE
    cosmic_summary IS NULL
    AND summary IS NOT NULL;

-- Move tags to cosmic_tags (if cosmic_tags is empty and tags has data)
UPDATE
    bookmarks
SET
    cosmic_tags = tags
WHERE
    cosmic_tags IS NULL
    AND tags IS NOT NULL;

-- Drop old indexes that reference columns we're removing
DROP INDEX IF EXISTS idx_bookmarks_tags;

-- Drop old columns that don't match interface
ALTER TABLE
    bookmarks DROP COLUMN summary,
    DROP COLUMN tags,
    DROP COLUMN description,
    DROP COLUMN content,
    DROP COLUMN raw_content;