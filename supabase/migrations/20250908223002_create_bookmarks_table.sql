-- Create bookmarks table
CREATE TABLE bookmarks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_url text NOT NULL,
    title varchar(500),
    description text,
    metadata jsonb, -- store BookmarkMetadata as JSON
    collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
    user_id uuid NOT NULL,
    is_archived boolean DEFAULT false,
    is_favorite boolean DEFAULT false,
    tags text[], -- array of tag strings
    content text, -- full page content
    summary text, -- AI-generated summary
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_collection_id ON bookmarks(collection_id);
CREATE INDEX idx_bookmarks_source_url ON bookmarks(source_url);
CREATE INDEX idx_bookmarks_is_archived ON bookmarks(is_archived);
CREATE INDEX idx_bookmarks_is_favorite ON bookmarks(is_favorite);
CREATE INDEX idx_bookmarks_tags ON bookmarks USING GIN(tags);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at);

-- Create unique constraint to prevent duplicate bookmarks per user
CREATE UNIQUE INDEX idx_bookmarks_user_url_unique ON bookmarks(user_id, source_url);

-- Add trigger to update updated_at column
CREATE TRIGGER update_bookmarks_updated_at 
    BEFORE UPDATE ON bookmarks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();