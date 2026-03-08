ALTER TABLE bookmarks
  ADD COLUMN is_private_link BOOLEAN NOT NULL DEFAULT false;
