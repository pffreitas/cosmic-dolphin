-- Create bookmark_tags table for many-to-many tag relationships
-- Note: This table provides more flexibility than the tags array in bookmarks table
-- It can be used for advanced tag management features in the future
CREATE TABLE bookmark_tags (
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag varchar(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (bookmark_id, tag)
);

-- Create indexes for performance
CREATE INDEX idx_bookmark_tags_bookmark_id ON bookmark_tags(bookmark_id);
CREATE INDEX idx_bookmark_tags_tag ON bookmark_tags(tag);

-- Create a view to get all unique tags with usage counts
CREATE VIEW tag_usage AS
SELECT 
    tag,
    COUNT(*) as usage_count,
    COUNT(DISTINCT bookmark_id) as bookmark_count
FROM bookmark_tags
GROUP BY tag
ORDER BY usage_count DESC;