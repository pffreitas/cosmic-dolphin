-- Fix scraped_url_contents.bookmark_id type mismatch: TEXT → UUID
-- All existing values are valid UUIDs (verified before migration)

ALTER TABLE scraped_url_contents
    ALTER COLUMN bookmark_id TYPE uuid USING bookmark_id::uuid;

ALTER TABLE scraped_url_contents
    DROP CONSTRAINT IF EXISTS fk_scraped_url_contents_bookmark;

ALTER TABLE scraped_url_contents
    ADD CONSTRAINT fk_scraped_url_contents_bookmark
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE;
