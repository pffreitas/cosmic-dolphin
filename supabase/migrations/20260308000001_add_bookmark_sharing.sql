ALTER TABLE bookmarks
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN share_slug VARCHAR(12) UNIQUE;

CREATE INDEX idx_bookmarks_share_slug ON bookmarks (share_slug) WHERE share_slug IS NOT NULL;
