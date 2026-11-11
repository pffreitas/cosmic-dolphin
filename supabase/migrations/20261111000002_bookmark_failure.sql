-- Classified extraction failures are owner-only; legacy rows retain NULL.
ALTER TABLE public.bookmarks
  ADD COLUMN processing_failure_code text NULL
  CHECK (processing_failure_code IN ('auth', 'blocked', 'empty', 'unsupported', 'unavailable', 'provider', 'paywall'));
