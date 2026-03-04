CREATE TABLE bookmark_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, bookmark_id)
);

CREATE INDEX idx_bookmark_likes_bookmark_id ON bookmark_likes(bookmark_id);
CREATE INDEX idx_bookmark_likes_user_id ON bookmark_likes(user_id);

ALTER TABLE bookmarks ADD COLUMN like_count integer NOT NULL DEFAULT 0;
