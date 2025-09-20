-- Add cosmic AI columns to bookmarks table
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS cosmic_summary TEXT;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS cosmic_tags TEXT[];
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS cosmic_images JSONB;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS cosmic_links JSONB;

-- Add comments for documentation
COMMENT ON COLUMN bookmarks.cosmic_summary IS 'AI-generated summary of the bookmark content';
COMMENT ON COLUMN bookmarks.cosmic_tags IS 'AI-generated tags for categorizing the bookmark';
COMMENT ON COLUMN bookmarks.cosmic_images IS 'AI-processed image data from the bookmark';
COMMENT ON COLUMN bookmarks.cosmic_links IS 'AI-processed link data from the bookmark';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_cosmic_tags ON bookmarks USING GIN(cosmic_tags);