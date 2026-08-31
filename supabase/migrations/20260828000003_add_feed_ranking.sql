-- The ranked feed's storage: what the user has already been shown, the index
-- the candidate query stands on, and the knob the weights turn on.
--
-- Three things land together because the ranker is not honest without all
-- three:
--
--   1. `feed_impressions` — the record of what was served and whether it was
--      opened. Without it the ranker re-serves the same unopened item forever,
--      which is the one failure mode docs/functional-spec/05-feed.md calls out
--      by name.
--   2. `idx_bookmarks_public_recent` — the covering index for the one new hot
--      path, the followed-saves half of the candidate query
--      (docs/functional-spec/07-data-model.md § Indexing note). The existing
--      `idx_bookmarks_user_unread` already covers the own-saves half.
--   3. `feed_ranking_config` — one row per environment, read at request time.
--      The spec is explicit that the six weights are "a starting point, not a
--      contract"; a starting point you have to redeploy to move is a constant
--      with extra steps.
--
-- What this migration deliberately does NOT add: `feed_feedback` (the feedback
-- deliverable owns it) and `feed_digests` (the digests deliverable owns it).
-- The ranker reserves the `digest` item type and enforces its spacing over an
-- empty set until that table exists.

-- ---------------------------------------------------------------------------
-- feed_impressions
-- ---------------------------------------------------------------------------

CREATE TABLE feed_impressions (
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- No foreign key on `item_id`, because it points at one of two tables
    -- depending on `item_type` and Postgres cannot express that. The cost of
    -- the missing FK is a dangling row after a hard delete, and a dangling
    -- impression is harmless: it decays an item that no longer exists.
    item_type text NOT NULL CHECK (item_type IN ('bookmark', 'digest')),
    item_id uuid NOT NULL,

    -- How many times this item has been *served*. `smallint` on purpose: the
    -- thresholds are 3 and 5, and a counter that needs more than 32,767 is
    -- describing a bug rather than a reader.
    served_count smallint NOT NULL DEFAULT 1,

    -- NULL means served and never opened — the state seen-decay acts on. Set
    -- when the user marks the bookmark read, which is the only event in the
    -- product that means "this person actually went in".
    opened_at timestamptz,

    last_served_at timestamptz NOT NULL DEFAULT now(),

    -- One row per (person, item). The upsert on serve increments in place, so
    -- this table grows with the size of the library rather than with the
    -- number of page views.
    PRIMARY KEY (user_id, item_type, item_id)
);

-- Two reads hang off this table and neither is served by the primary key.
--
-- Resuming a lost paging session asks "what did I serve this person in the
-- last quarter of an hour", and the novelty signal asks "what were the last
-- twenty items I served them" — both are (user, recency), descending.
CREATE INDEX idx_feed_impressions_user_served
    ON feed_impressions(user_id, last_served_at DESC);

COMMENT ON TABLE feed_impressions IS
    'What the feed served each user and whether they opened it. The highest-write table in the feed set; prune rows older than 60 days.';
COMMENT ON COLUMN feed_impressions.served_count IS
    'Seen decay: x0.6 after 3 unopened impressions, dropped from For you after 5. Still reachable in the Unread scope, which does not rank.';

ALTER TABLE feed_impressions ENABLE ROW LEVEL SECURITY;

-- Owner only, on read and on write alike. An impression row says what someone
-- has been reading and what they ignored, which is at least as sensitive as
-- the library it is derived from.
CREATE POLICY feed_impressions_owner_select ON feed_impressions
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY feed_impressions_owner_insert ON feed_impressions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY feed_impressions_owner_update ON feed_impressions
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY feed_impressions_owner_delete ON feed_impressions
    FOR DELETE
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The candidate query's covering index
-- ---------------------------------------------------------------------------

-- "Everything this author has shared, newest first." Partial on the two flags
-- that make a save public, so the index holds only rows the feed can ever
-- return — archived rows drop out because archiving is how a user takes
-- something out of circulation without deleting it.
CREATE INDEX idx_bookmarks_public_recent
    ON bookmarks(user_id, created_at DESC)
    WHERE is_public = true AND is_archived = false;

-- ---------------------------------------------------------------------------
-- feed_ranking_config
-- ---------------------------------------------------------------------------

-- One row per environment, read at request time, with the values compiled into
-- `packages/shared/src/services/feed-ranking.config.ts` as the fallback.
--
-- The fallback is what makes this safe: an empty table, a missing row, or a row
-- with three of the six weights in it all produce a working ranker, because
-- every field is merged over the file's values rather than replacing them. The
-- table is a set of overrides, not a definition.
CREATE TABLE feed_ranking_config (
    environment text PRIMARY KEY,

    -- The six weights, as a partial object: {"topic_affinity": 0.4, ...}.
    -- Deliberately not six columns. The weight set is the thing most likely to
    -- gain a member, and gaining one should not be a migration.
    weights jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Everything else that is a number rather than a policy: half-life, caps,
    -- thresholds, the candidate cap, the cache TTL.
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,

    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE feed_ranking_config IS
    'Ranking weights and parameters, one row per environment, read at request time. Overrides only: anything absent falls back to the values in feed-ranking.config.ts.';

ALTER TABLE feed_ranking_config ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user, writable by nobody through the anon or
-- authenticated roles. The API reads it with the service role, which bypasses
-- RLS; tuning the feed is an operator action, not a user action, and there is
-- no endpoint that writes here.
CREATE POLICY feed_ranking_config_read ON feed_ranking_config
    FOR SELECT
    TO authenticated
    USING (true);
