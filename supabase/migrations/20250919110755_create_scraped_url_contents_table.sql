-- Create scraped_url_contents table to store processed web content
CREATE TABLE IF NOT EXISTS scraped_url_contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bookmark_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  images JSONB,
  links JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on bookmark_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_scraped_url_contents_bookmark_id
ON scraped_url_contents(bookmark_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scraped_url_contents_updated_at
  BEFORE UPDATE ON scraped_url_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE scraped_url_contents IS 'Stores processed web content from scraped URLs';
COMMENT ON COLUMN scraped_url_contents.bookmark_id IS 'Reference to the bookmark this content belongs to';
COMMENT ON COLUMN scraped_url_contents.title IS 'Extracted title from the scraped content';
COMMENT ON COLUMN scraped_url_contents.content IS 'Main text content extracted from the URL';
COMMENT ON COLUMN scraped_url_contents.metadata IS 'JSON object containing bookmark metadata (openGraph, wordCount, readingTime)';
COMMENT ON COLUMN scraped_url_contents.images IS 'JSON array of extracted images with url and alt text';
COMMENT ON COLUMN scraped_url_contents.links IS 'JSON array of extracted links with url and text';