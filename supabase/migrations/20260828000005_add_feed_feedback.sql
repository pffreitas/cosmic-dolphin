-- Feed feedback — docs/functional-spec/05-feed.md § Feedback.
--
-- The three things a reader can say from an item's overflow menu, stored so
-- the ranker can act on them on the *next* request. That word is the whole
-- point of the table: a dismissal that took effect eventually would read to
-- the person who made it as a dismissal that did nothing.
--
-- Deliberately three kinds in one table rather than three tables. They share a
-- lifetime (the reader's), a scope (owner only), and a reader (one query at
-- the top of every ranking); splitting them would turn that one query into
-- three to express a difference that is a single `kind` column wide.

CREATE TABLE feed_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    kind text NOT NULL
        CHECK (kind IN ('not_interested', 'fewer_domain', 'mute_topic')),

    -- `not_interested` — this item, and only this item.
    bookmark_id uuid REFERENCES bookmarks(id) ON DELETE CASCADE,

    -- `fewer_domain` — bare host, `www.` stripped, lowercased by the API so
    -- `Every.to` and `www.every.to` are one opinion rather than two.
    domain text,

    -- `mute_topic` — one `cosmic_tags` entry, lowercased for the same reason.
    topic text,

    created_at timestamptz NOT NULL DEFAULT now(),

    -- Exactly one target, and it must be the one the kind is about. Without
    -- this a `fewer_domain` row could arrive carrying only a bookmark id and
    -- the ranker would have to guess which domain was meant — which is how a
    -- reader ends up muting a source they never named.
    CONSTRAINT feed_feedback_target_matches_kind CHECK (
        (kind = 'not_interested'
            AND bookmark_id IS NOT NULL AND domain IS NULL AND topic IS NULL)
        OR (kind = 'fewer_domain'
            AND domain IS NOT NULL AND bookmark_id IS NULL AND topic IS NULL)
        OR (kind = 'mute_topic'
            AND topic IS NOT NULL AND bookmark_id IS NULL AND domain IS NULL)
    )
);

-- The ranker's read: everything this person has told the feed, in one query at
-- the top of a ranking.
CREATE INDEX idx_feed_feedback_user ON feed_feedback(user_id, kind);

-- One row per (person, kind, target).
--
-- Pressing "Not interested" twice on the same item is one opinion, not two,
-- and `fewer_domain` is *counted* by the ranker — three rows for every.to
-- means the source is weighted down three times over. That is a real
-- difference between a reader who said it once and one who said it three
-- times, and it is only meaningful if a double-click cannot manufacture it.
-- The API inserts with ON CONFLICT DO NOTHING against these.
CREATE UNIQUE INDEX idx_feed_feedback_bookmark
    ON feed_feedback(user_id, kind, bookmark_id)
    WHERE bookmark_id IS NOT NULL;

CREATE UNIQUE INDEX idx_feed_feedback_domain
    ON feed_feedback(user_id, kind, domain)
    WHERE domain IS NOT NULL;

CREATE UNIQUE INDEX idx_feed_feedback_topic
    ON feed_feedback(user_id, kind, topic)
    WHERE topic IS NOT NULL;

COMMENT ON TABLE feed_feedback IS
    'What a reader told the feed from an item overflow menu. Read once at the top of every ranking; a dismissal takes effect on the next request.';
COMMENT ON COLUMN feed_feedback.kind IS
    'not_interested drops the item from every scope; mute_topic drops everything carrying the tag; fewer_domain is a weight, not a ban — dismissalWeight (3) pseudo-saves that were never finished.';

ALTER TABLE feed_feedback ENABLE ROW LEVEL SECURITY;

-- Owner only, on read and on write alike, exactly like `feed_impressions`.
-- What a person told the feed to stop showing them is at least as revealing as
-- what they saved.
CREATE POLICY feed_feedback_owner_select ON feed_feedback
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY feed_feedback_owner_insert ON feed_feedback
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY feed_feedback_owner_update ON feed_feedback
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY feed_feedback_owner_delete ON feed_feedback
    FOR DELETE
    USING (user_id = auth.uid());
