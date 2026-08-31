-- Key points as data, not as markdown to be re-parsed on every render.
--
-- The full brief (`cosmic_summary`) is markdown with a "## Key Points" section.
-- Reading them out of it at render time means every library row, feed item and
-- digest re-parses a document to draw three bullets, and any drift in the
-- model's formatting becomes a rendering bug instead of a pipeline one. The
-- `summarise` phase now parses once and stores the result.
--
-- docs/functional-spec/03-ai-pipeline.md § Outputs — 2–5 findings, each
-- <= 140 characters. Findings, not a sequence: the UI renders them with a dot
-- marker and never numbers them.
--
-- Nullable and not backfilled on purpose: NULL means "this bookmark predates
-- the column", which reads differently from `[]` ("the summariser found no key
-- points"). Existing bookmarks pick the column up on their next run.
ALTER TABLE bookmarks
    ADD COLUMN cosmic_key_points jsonb;

COMMENT ON COLUMN bookmarks.cosmic_key_points IS
    'Key points from cosmic_summary as a JSON array of strings. Written by the summarise phase.';

-- The daily processing budget counts a user's runs in the current UTC day
-- before every enqueue. The existing index leads with bookmark_id, so it
-- cannot serve a user-and-time query.
CREATE INDEX idx_bookmark_processing_runs_user_started
    ON bookmark_processing_runs(user_id, started_at DESC);
