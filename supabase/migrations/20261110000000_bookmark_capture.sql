-- Capture intent belongs to the bookmark row, never replaceable scrape metadata.
ALTER TABLE public.bookmarks
  ADD COLUMN user_note text CHECK (char_length(user_note) <= 500),
  ADD COLUMN later_until timestamptz,
  ADD COLUMN capture_source text CHECK (capture_source IN ('ios_share_extension', 'android_share', 'save_sheet', 'clipboard')),
  ADD COLUMN capture_platform text CHECK (capture_platform IN ('ios', 'android', 'web', 'unknown')),
  ADD COLUMN capture_queued_at timestamptz;
CREATE INDEX bookmarks_user_later_until_idx ON public.bookmarks (user_id, later_until);
