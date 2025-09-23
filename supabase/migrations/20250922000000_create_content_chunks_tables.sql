-- Create content chunks tables with table-per-type pattern
-- Base content chunks table with common fields
CREATE TABLE IF NOT EXISTS content_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scraped_content_id UUID NOT NULL REFERENCES scraped_url_contents(id) ON DELETE CASCADE,
    chunk_type VARCHAR(20) NOT NULL CHECK (chunk_type IN ('text', 'image')),
    index INTEGER NOT NULL,
    size INTEGER NOT NULL,
    start_position INTEGER NOT NULL,
    end_position INTEGER NOT NULL
);

-- Text-specific data
CREATE TABLE IF NOT EXISTS text_chunks (
    chunk_id UUID PRIMARY KEY REFERENCES content_chunks(id) ON DELETE CASCADE,
    content TEXT NOT NULL
);

-- Image-specific data
CREATE TABLE IF NOT EXISTS image_chunks (
    chunk_id UUID PRIMARY KEY REFERENCES content_chunks(id) ON DELETE CASCADE,
    image_data BYTEA NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    alt_text TEXT,
    original_url TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_chunks_scraped_content
ON content_chunks(scraped_content_id);

CREATE INDEX IF NOT EXISTS idx_content_chunks_type
ON content_chunks(chunk_type);

CREATE INDEX IF NOT EXISTS idx_content_chunks_index
ON content_chunks(scraped_content_id, index);

-- Create updated_at trigger for content_chunks
CREATE TRIGGER update_content_chunks_updated_at
  BEFORE UPDATE ON content_chunks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE content_chunks IS 'Base table for content chunks with common fields';
COMMENT ON COLUMN content_chunks.scraped_content_id IS 'Reference to the scraped content this chunk belongs to';
COMMENT ON COLUMN content_chunks.chunk_type IS 'Type of chunk: text or image';
COMMENT ON COLUMN content_chunks.index IS 'Sequential index of this chunk within the content';
COMMENT ON COLUMN content_chunks.size IS 'Size of the chunk in bytes';
COMMENT ON COLUMN content_chunks.start_position IS 'Starting position of chunk in original content';
COMMENT ON COLUMN content_chunks.end_position IS 'Ending position of chunk in original content';

COMMENT ON TABLE text_chunks IS 'Text-specific data for content chunks';
COMMENT ON COLUMN text_chunks.content IS 'Text content of the chunk';

COMMENT ON TABLE image_chunks IS 'Image-specific data for content chunks';
COMMENT ON COLUMN image_chunks.image_data IS 'Binary image data stored as BYTEA';
COMMENT ON COLUMN image_chunks.mime_type IS 'MIME type of the image (e.g., image/jpeg, image/png)';
COMMENT ON COLUMN image_chunks.alt_text IS 'Alternative text description for the image';
COMMENT ON COLUMN image_chunks.original_url IS 'Original URL where the image was found';