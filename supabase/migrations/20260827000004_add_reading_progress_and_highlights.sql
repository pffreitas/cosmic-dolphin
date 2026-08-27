-- Reading progress and highlights.
--
-- Two tables that record what a person did *inside* a saved page: how far they
-- got, and which sentences were worth keeping. Both are strictly per-user and
-- stay per-user even when the bookmark itself is public
-- (docs/functional-spec/04-library.md § Reading progress, § Highlights).
--
-- Neither table replaces `bookmarks.read_at`, which already exists
-- (20260617000001) and stays the only record of "read". Progress is evidence;
-- read state is a decision. The system may *suggest* marking read at 90%, and
-- never sets it silently — docs/functional-spec/04-library.md § Read state.

-- How far down a bookmark a person has got.
--
-- One row per (user, bookmark), never a history: this is a cursor, not an
-- event log. `PRIMARY KEY (user_id, bookmark_id)` is what makes the write an
-- idempotent upsert on the hottest client-driven endpoint in the product.
CREATE TABLE bookmark_reading_progress (
    user_id uuid NOT NULL,
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- Monotonic, and enforced on the write rather than here: the upsert in
    -- `BookmarkReadingRepository.saveProgress` carries
    -- `WHERE excluded.percent >= bookmark_reading_progress.percent`, so a
    -- lower value cannot land even from two concurrent tabs. A CHECK cannot
    -- express "greater than the value already stored"; the guarded upsert can,
    -- without a read-modify-write to race against.
    percent smallint NOT NULL DEFAULT 0 CHECK (percent BETWEEN 0 AND 100),

    -- Where to put the scrollbar back. Advisory only — a re-extraction changes
    -- the document's height and the client falls back to `percent`.
    scroll_offset integer,

    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, bookmark_id)
);

-- The Continue reading rail's only query: this user's in-flight reads, newest
-- activity first. The partial predicate is the definition of "in progress"
-- from docs/functional-spec/04-library.md — under 5% is unstarted, over 95%
-- offers to be marked read — so the rail never has to filter what it reads.
CREATE INDEX idx_reading_progress_in_flight
    ON bookmark_reading_progress(user_id, updated_at DESC)
    WHERE percent BETWEEN 5 AND 95;

COMMENT ON COLUMN bookmark_reading_progress.percent IS
    'Monotonic per (user, bookmark). Scrolling back up has not un-read anything, so a lower value is refused by the upsert rather than trusted.';

-- A span of extracted content a person kept.
--
-- Anchored by quote plus surrounding context, never by character offsets:
-- re-extraction rewrites the document and every offset with it, and a
-- highlight that silently lands on the wrong sentence is worse than one that
-- reports itself unanchored. Resolution lives in
-- `packages/shared/src/highlight-anchor.ts`.
CREATE TABLE bookmark_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- The selected text itself, whitespace-normalised by the API before it
    -- lands. Bounded because it is the search key of the anchoring pass and an
    -- unbounded one turns a fuzzy match into a denial of service.
    quote text NOT NULL
        CHECK (char_length(quote) BETWEEN 1 AND 2000),

    -- ~32 characters either side. Enough to disambiguate a sentence that
    -- occurs twice; short enough that an edit nearby does not invalidate it.
    prefix text CHECK (prefix IS NULL OR char_length(prefix) <= 200),
    suffix text CHECK (suffix IS NULL OR char_length(suffix) <= 200),

    note text CHECK (note IS NULL OR char_length(note) <= 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Every read of this table is "this bookmark, this reader" — the pair, always,
-- because a highlight on a public bookmark belongs to whoever made it and to
-- nobody else. Leading with `bookmark_id` matches the detail page's query and
-- still serves the reader-scoped one.
CREATE INDEX idx_bookmark_highlights_bookmark
    ON bookmark_highlights(bookmark_id, user_id);

COMMENT ON TABLE bookmark_highlights IS
    'Private to `user_id` even when the parent bookmark is public. Enforced in SQL on every read and write, not by a route guard.';

COMMENT ON COLUMN bookmark_highlights.prefix IS
    'Text immediately before the quote, used to disambiguate a repeated quote and to re-find one whose own words changed.';

-- Owner only, on read and on write — docs/functional-spec/07-data-model.md
-- § Row-level security. The backend connects as the service role and bypasses
-- this; the policies are what stand between one user's reading and another
-- user reaching it through PostgREST or the realtime channel. For
-- `bookmark_highlights` this is the second of the two locks: the repository's
-- queries are scoped to `user_id` in SQL, and these policies mean a client
-- that never goes through the API cannot do better.
ALTER TABLE bookmark_reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmark_reading_progress_owner_select ON bookmark_reading_progress
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY bookmark_reading_progress_owner_insert ON bookmark_reading_progress
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY bookmark_reading_progress_owner_update ON bookmark_reading_progress
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY bookmark_reading_progress_owner_delete ON bookmark_reading_progress
    FOR DELETE
    USING (user_id = auth.uid());

ALTER TABLE bookmark_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmark_highlights_owner_select ON bookmark_highlights
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY bookmark_highlights_owner_insert ON bookmark_highlights
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY bookmark_highlights_owner_update ON bookmark_highlights
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY bookmark_highlights_owner_delete ON bookmark_highlights
    FOR DELETE
    USING (user_id = auth.uid());
