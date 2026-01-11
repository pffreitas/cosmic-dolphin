-- Add processing status columns to bookmarks table
-- This enables tracking of background processing state for realtime updates

-- Create enum type for processing status
CREATE TYPE bookmark_processing_status AS ENUM ('idle', 'processing', 'completed', 'failed');

-- Add processing status columns
ALTER TABLE bookmarks
ADD COLUMN processing_status bookmark_processing_status DEFAULT 'idle' NOT NULL,
ADD COLUMN processing_started_at TIMESTAMPTZ,
ADD COLUMN processing_completed_at TIMESTAMPTZ,
ADD COLUMN processing_error TEXT;

-- Add index for querying bookmarks by processing status
CREATE INDEX idx_bookmarks_processing_status ON bookmarks(processing_status);

-- Add comment for documentation
COMMENT ON COLUMN bookmarks.processing_status IS 'Current processing state: idle, processing, completed, or failed';
COMMENT ON COLUMN bookmarks.processing_started_at IS 'Timestamp when background processing started';
COMMENT ON COLUMN bookmarks.processing_completed_at IS 'Timestamp when background processing completed';
COMMENT ON COLUMN bookmarks.processing_error IS 'Error message if processing failed';
