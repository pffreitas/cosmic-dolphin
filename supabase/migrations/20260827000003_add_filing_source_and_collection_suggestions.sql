-- Filing becomes a suggestion, and the user's decision becomes permanent.
--
-- Until now the `file` phase (née `categorization`) created collections
-- outright: every run that could not match the tree invented a branch, and a
-- reprocess could move a bookmark the user had filed by hand. Both stop here.
--
-- docs/functional-spec/README.md § Non-negotiables (2): "AI never destroys user
-- intent. It suggests filing, tags, and summaries; a user decision always wins
-- and is never silently overridden."

-- `filing_source` is the override flag. 'ai' means the pipeline chose this
-- collection and may choose again; 'user' means a human did, and the pipeline
-- must never move the row afterwards, on any subsequent run.
--
-- Defaulting to 'ai' is the right reading of history: every existing
-- `collection_id` was written by the old categoriser, not by a person. There is
-- no record of a manual refile to preserve, because until D7 there was no way
-- to perform one.
ALTER TABLE bookmarks
    ADD COLUMN filing_source text NOT NULL DEFAULT 'ai'
        CHECK (filing_source IN ('ai', 'user')),
    ADD COLUMN saved_from_bookmark_id uuid
        REFERENCES bookmarks(id) ON DELETE SET NULL;

COMMENT ON COLUMN bookmarks.filing_source IS
    'Who chose collection_id: ''ai'' (the file phase, may be revised) or ''user'' (manual, never overridden by the pipeline).';

COMMENT ON COLUMN bookmarks.saved_from_bookmark_id IS
    'Reshare provenance: the bookmark this one was saved from. ON DELETE SET NULL — losing the origin must not lose the save.';

-- Every write that files a bookmark from the pipeline carries
-- `WHERE filing_source = 'ai'`, so this index is on the hot path of the
-- override rule as well as of D13's "who reshared this".
CREATE INDEX idx_bookmarks_saved_from
    ON bookmarks(saved_from_bookmark_id)
    WHERE saved_from_bookmark_id IS NOT NULL;

-- A proposed collection, not a created one.
--
-- The model may decide the tree has no good home for a bookmark and propose a
-- new branch. That proposal accumulates supporting bookmarks here and is only
-- offered to the user once at least five of them agree
-- (docs/functional-spec/03-ai-pipeline.md § Filing). Until the user presses
-- Create, no collection exists and the bookmarks sit in Inbox — which is a
-- valid resting place, not a failure.
CREATE TABLE collection_suggestions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    name text NOT NULL,
    parent_id uuid REFERENCES collections(id) ON DELETE CASCADE,
    bookmark_ids uuid[] NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'dismissed')),
    dismissed_until timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- The rail's query: this user's suggestions in a given state.
CREATE INDEX idx_collection_suggestions_user_status
    ON collection_suggestions(user_id, status);

-- One pending proposal per name per parent. Without this, every run that
-- reaches the same conclusion opens a fresh proposal with one supporting
-- bookmark and the five-bookmark threshold is never crossed.
--
-- `COALESCE` rather than two partial indexes so a single upsert statement can
-- infer the conflict target; the sentinel is the nil UUID, which cannot collide
-- with a real `collections.id`. `lower(name)` because "Machine learning" and
-- "Machine Learning" are the same proposal.
--
-- Accepted and dismissed rows are deliberately outside the index: a dismissal
-- has to survive alongside a later proposal, and the repository checks for one
-- before proposing again.
CREATE UNIQUE INDEX idx_collection_suggestions_pending_unique
    ON collection_suggestions(
        user_id,
        lower(name),
        COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE status = 'pending';

COMMENT ON COLUMN collection_suggestions.bookmark_ids IS
    'Bookmarks whose filing pointed at this proposal. At least 5 before it is offered to the user.';

COMMENT ON COLUMN collection_suggestions.dismissed_until IS
    'A dismissal is remembered, not permanent: the proposal may return after this instant.';

-- Owner only, on read and on write — docs/functional-spec/07-data-model.md
-- § Row-level security. The backend connects as the service role and bypasses
-- this; the policy is what stands between a suggestion and any other user
-- reaching it through PostgREST or the realtime channel.
ALTER TABLE collection_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_suggestions_owner_select ON collection_suggestions
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY collection_suggestions_owner_insert ON collection_suggestions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY collection_suggestions_owner_update ON collection_suggestions
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY collection_suggestions_owner_delete ON collection_suggestions
    FOR DELETE
    USING (user_id = auth.uid());
