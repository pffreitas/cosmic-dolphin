-- Add raw_content column to bookmarks table to store raw HTML
ALTER TABLE bookmarks ADD COLUMN raw_content text;

-- Add comments to clarify the purpose of content fields
COMMENT ON COLUMN bookmarks.raw_content IS 'Raw HTML content fetched from source URL';
COMMENT ON COLUMN bookmarks.content IS 'Markdown content converted from raw HTML';