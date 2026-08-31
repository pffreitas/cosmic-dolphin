-- Digests: the AI-authored feed item that groups the user's own recent saves
-- into one observation — docs/functional-spec/05-feed.md § Digests.
--
-- Three things land together because a digest is not useful without all three:
--
--   1. `feed_digests` — the digest itself, including the source bookmark ids
--      it was built from. The provenance is *in the row*, not reconstructed
--      later: an AI output that cannot name what it was built from does not
--      get rendered, and a nullable join table would make "cannot name" a
--      reachable state.
--   2. `feed_digest_likes` — a digest is a first-class social object, so it
--      gets its own likes rather than borrowing a bookmark's. Denormalised
--      into `feed_digests.like_count` by trigger, the same shape
--      `bookmarks.comment_count` already uses, because the feed reads a count
--      on every item.
--   3. The `digests` pgmq queue — the per-user generation job travels the same
--      path as every other background job. The worker's scheduler enqueues
--      onto this queue and its poll loop drains it; no second broker.
--
-- What this migration deliberately does NOT add: any column that would let a
-- digest exist without its sources. `source_bookmark_ids` is NOT NULL with a
-- cardinality CHECK, so "a digest names every bookmark it was built from" is a
-- storage-level guarantee and not a convention.

-- ---------------------------------------------------------------------------
-- feed_digests
-- ---------------------------------------------------------------------------

CREATE TABLE feed_digests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- The observation, in one line, and the paragraph under it.
    title text NOT NULL,
    summary text NOT NULL,

    -- 2-3 findings: [{"term": "...", "text": "..."}]. JSONB rather than a
    -- child table for the same reason `cosmic_key_points` is: they are read
    -- with the digest, always, and never queried on their own.
    key_points jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- Every bookmark the digest was built from, in cluster order.
    --
    -- No foreign key: an array cannot carry one, and the alternative — a join
    -- table — would allow a digest with zero rows in it, which is precisely
    -- the state the provenance rule forbids. The CHECK below is the guarantee
    -- that matters, and a deleted bookmark leaves an id the reader resolves to
    -- nothing rather than a digest that silently loses a source.
    source_bookmark_ids uuid[] NOT NULL,

    -- 3-6 saves, per the spec. Two saves are a coincidence and seven are a
    -- reading list; neither is an observation.
    CONSTRAINT feed_digests_source_count
        CHECK (array_length(source_bookmark_ids, 1) BETWEEN 3 AND 6),

    -- The cluster's measured mean pairwise cosine similarity, 0..1. Stored so
    -- the threshold that produced this digest can be read off the row: the
    -- generator's bar is a number in configuration, and a digest that cannot
    -- say which number it cleared is not auditable.
    coherence real NOT NULL CHECK (coherence >= 0 AND coherence <= 1),

    -- Which model wrote it, per the provenance rule in
    -- docs/functional-spec/03-ai-pipeline.md § Provenance.
    model_id text,

    -- The window the cluster was drawn from — the last 14 days at generation
    -- time. Kept because "your saves from this fortnight" is a claim the
    -- digest makes, and a claim with no recorded bounds cannot be checked.
    window_start timestamptz NOT NULL,
    window_end timestamptz NOT NULL,

    -- Sharing, exactly as bookmarks do it: a slug that exists once shared and
    -- survives an unshare, so re-sharing does not break a link someone kept.
    is_public boolean NOT NULL DEFAULT false,
    share_slug text UNIQUE,

    like_count integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- The ranker's digest candidate query, exactly: this user's digests, newest
-- first, inside the eligibility window.
CREATE INDEX idx_feed_digests_user_recent
    ON feed_digests(user_id, created_at DESC);

-- The generator's own read: "when did I last write this person a digest, and
-- what was in it" — used to avoid writing the same cluster twice in a row.
-- GIN on the id array so an overlap test is an index scan rather than a
-- sequential unnest of everything the user has ever been sent.
CREATE INDEX idx_feed_digests_sources
    ON feed_digests USING gin (source_bookmark_ids);

COMMENT ON TABLE feed_digests IS
    'AI-authored groupings of a user''s own recent saves. Written by the worker on a schedule, only when a cluster clears the coherence threshold.';
COMMENT ON COLUMN feed_digests.source_bookmark_ids IS
    'Every bookmark the digest was built from. Never truncated: it is the Built from provenance row.';
COMMENT ON COLUMN feed_digests.coherence IS
    'Mean pairwise cosine similarity of the source cluster. A weak cluster produces no digest at all, so every stored row is above the generator threshold.';

ALTER TABLE feed_digests ENABLE ROW LEVEL SECURITY;

-- Owner unless public. A digest is written *from someone's private library*,
-- so the default is closed: the owner always sees their own, and everyone else
-- sees it only once it has been shared.
CREATE POLICY feed_digests_owner_or_public_select ON feed_digests
    FOR SELECT
    USING (user_id = auth.uid() OR is_public = true);

-- Nobody inserts a digest through a user session — the worker writes them with
-- the service role, which bypasses RLS. The policy exists anyway, scoped to the
-- owner, so that a future authenticated write path cannot land unnoticed with
-- no rule attached.
CREATE POLICY feed_digests_owner_insert ON feed_digests
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Sharing and unsharing are updates, and they are the owner's alone.
CREATE POLICY feed_digests_owner_update ON feed_digests
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY feed_digests_owner_delete ON feed_digests
    FOR DELETE
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- feed_digest_likes
-- ---------------------------------------------------------------------------

CREATE TABLE feed_digest_likes (
    digest_id uuid NOT NULL REFERENCES feed_digests(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (digest_id, user_id)
);

-- "Have I liked this one" on a page of feed items, keyed by the viewer.
CREATE INDEX idx_feed_digest_likes_user
    ON feed_digest_likes(user_id, digest_id);

ALTER TABLE feed_digest_likes ENABLE ROW LEVEL SECURITY;

-- A like is readable by anyone who can read the digest it is on, and writable
-- only as yourself. The `EXISTS` re-runs the digest's own visibility rule
-- rather than restating it, so the two can never drift apart.
CREATE POLICY feed_digest_likes_visible_select ON feed_digest_likes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM feed_digests d
            WHERE d.id = feed_digest_likes.digest_id
              AND (d.user_id = auth.uid() OR d.is_public = true)
        )
    );

CREATE POLICY feed_digest_likes_self_insert ON feed_digest_likes
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM feed_digests d
            WHERE d.id = feed_digest_likes.digest_id
              AND (d.user_id = auth.uid() OR d.is_public = true)
        )
    );

CREATE POLICY feed_digest_likes_self_delete ON feed_digest_likes
    FOR DELETE
    USING (user_id = auth.uid());

-- The denormalised count, maintained where it cannot drift: a like written by
-- any path updates the count in the same transaction.
CREATE OR REPLACE FUNCTION feed_digest_likes_sync_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feed_digests
           SET like_count = like_count + 1
         WHERE id = NEW.digest_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feed_digests
           SET like_count = GREATEST(like_count - 1, 0)
         WHERE id = OLD.digest_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER feed_digest_likes_count
    AFTER INSERT OR DELETE ON feed_digest_likes
    FOR EACH ROW EXECUTE FUNCTION feed_digest_likes_sync_count();

-- ---------------------------------------------------------------------------
-- The digests queue
-- ---------------------------------------------------------------------------

-- The scheduled tick enqueues here; the worker's existing poll loop drains it.
-- A separate queue from `bookmarks` so a backlog of link processing cannot
-- delay digest generation, and vice versa — but the same broker, the same
-- message shape, and the same handler dispatch as every other job.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
        PERFORM pgmq.create('digests');
        RAISE NOTICE 'pgmq digests queue created successfully';
    ELSE
        RAISE NOTICE 'pgmq not available, skipping digests queue creation for testing';
    END IF;
END $$;
