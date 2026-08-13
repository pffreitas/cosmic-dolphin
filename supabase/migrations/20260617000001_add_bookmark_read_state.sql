ALTER TABLE bookmarks
  ADD COLUMN read_at timestamptz;

CREATE INDEX idx_bookmarks_read_at ON bookmarks(read_at);
CREATE INDEX idx_bookmarks_user_unread
  ON bookmarks(user_id, created_at DESC)
  WHERE read_at IS NULL AND is_archived = false;
