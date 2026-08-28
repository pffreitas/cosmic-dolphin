-- Comments, and the moderation floor underneath them.
--
-- Three things land together because none of them is safe to ship alone:
--
--   1. `bookmark_comments` — conversation on public bookmarks, one level deep
--      (docs/functional-spec/06-social.md § Comment).
--   2. `bookmarks.comment_count` — denormalised, maintained by trigger, because
--      the feed reads a count on every item and a count query per item does not
--      survive contact with a 20-item page
--      (docs/functional-spec/07-data-model.md).
--   3. `content_reports` — the report target. Public comments without a way to
--      report them is a product decision nobody would make on purpose.
--
-- What this migration deliberately does NOT add: any column, index or trigger
-- that could hide reported content. Reported content stays visible pending
-- review, because auto-hide is trivially weaponised — one motivated account
-- can silence anything. The `status` column is a queue marker for humans, not
-- a visibility flag, and nothing reads it on the serving path.

-- ---------------------------------------------------------------------------
-- bookmark_comments
-- ---------------------------------------------------------------------------

CREATE TABLE bookmark_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- One level of nesting, and the depth rule is enforced in the service
    -- rather than here: a self-referencing CHECK cannot see the parent's own
    -- parent without a subquery, and a trigger that *rejected* a reply-to-a-
    -- reply would turn a normal user action into an error. The product rule is
    -- that such a reply **attaches to the grandparent** — a re-point, not a
    -- refusal — which is a decision, not a constraint.
    parent_id uuid REFERENCES bookmark_comments(id) ON DELETE CASCADE,

    -- Plain text plus links. No rich text, no images, no embeds. The cap is
    -- here as well as in the API because it is the one bound that stops a
    -- single row from being a denial of service.
    body text NOT NULL CHECK (char_length(body) <= 2000),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Soft delete. Set when the comment has replies: dropping it outright
    -- would take its replies with it via the cascade above, and the people who
    -- wrote them did not ask for that. A comment with no replies is deleted
    -- for real.
    deleted_at timestamptz
);

-- The thread query, exactly: one bookmark's live comments in chronological
-- order. Partial on `deleted_at IS NULL` so tombstones — which are read only
-- when a reply hangs off them — stay out of the hot index.
CREATE INDEX idx_bookmark_comments_bookmark
    ON bookmark_comments(bookmark_id, created_at)
    WHERE deleted_at IS NULL;

-- "Does this comment have replies?" is asked on every delete, and it looks up
-- by parent, which the index above cannot serve.
CREATE INDEX idx_bookmark_comments_parent
    ON bookmark_comments(parent_id)
    WHERE parent_id IS NOT NULL;

COMMENT ON TABLE bookmark_comments IS
    'One level of nesting. A reply to a reply attaches to the same parent — enforced in CommentService, not by a constraint, because the rule is a re-point rather than a refusal.';
COMMENT ON COLUMN bookmark_comments.deleted_at IS
    'Soft delete, used only when the comment has replies; it then renders as "Comment deleted". A childless comment is hard-deleted and leaves no row.';
COMMENT ON COLUMN bookmark_comments.updated_at IS
    'Equal to created_at until edited. Editing is allowed for 15 minutes after creation and refused after that.';

-- ---------------------------------------------------------------------------
-- bookmarks.comment_count
-- ---------------------------------------------------------------------------

ALTER TABLE bookmarks ADD COLUMN comment_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookmarks.comment_count IS
    'Live (non-deleted) comments. Maintained by trigger; never written by application code.';

-- Maintained by trigger rather than by the writer.
--
-- `like_count` is kept in step by the like repository's own UPDATE, which
-- works because exactly one statement in the codebase writes a like. Comments
-- have four writers — insert, edit, soft delete, hard delete — plus a cascade
-- from `bookmarks` and from a parent comment, and the cascade is the one no
-- application statement can see. A trigger is the only place that observes all
-- six.
--
-- A tombstone does not count. "3 comments" that resolves to two comments and a
-- "Comment deleted" is a small lie the count should not tell.
CREATE OR REPLACE FUNCTION public.sync_bookmark_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.deleted_at IS NULL THEN
            UPDATE bookmarks SET comment_count = comment_count + 1
            WHERE id = NEW.bookmark_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        -- A hard-deleted tombstone was already not counted, so only a live row
        -- decrements. This is also the path a cascade takes: deleting a parent
        -- comment removes its replies, and each of them arrives here.
        IF OLD.deleted_at IS NULL THEN
            UPDATE bookmarks SET comment_count = GREATEST(comment_count - 1, 0)
            WHERE id = OLD.bookmark_id;
        END IF;
        RETURN OLD;
    END IF;

    -- UPDATE. Only a change in liveness moves the count; an edit does not.
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE bookmarks SET comment_count = GREATEST(comment_count - 1, 0)
        WHERE id = NEW.bookmark_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE bookmarks SET comment_count = comment_count + 1
        WHERE id = NEW.bookmark_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_bookmark_comment_count() IS
    'Keeps bookmarks.comment_count equal to the number of live comments. Counts liveness transitions, not rows written, so an edit is free and a soft delete decrements exactly once.';

CREATE TRIGGER bookmark_comments_count_sync
    AFTER INSERT OR UPDATE OF deleted_at OR DELETE ON bookmark_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_bookmark_comment_count();

-- ---------------------------------------------------------------------------
-- content_reports
-- ---------------------------------------------------------------------------

CREATE TABLE content_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    bookmark_id uuid REFERENCES bookmarks(id) ON DELETE CASCADE,
    comment_id uuid REFERENCES bookmark_comments(id) ON DELETE CASCADE,

    reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),

    -- A queue marker for the internal review process. Nothing on the serving
    -- path reads it: reported content stays visible whatever this says.
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'reviewed', 'actioned')),

    created_at timestamptz NOT NULL DEFAULT now(),

    -- Exactly one target. A report of "this bookmark and also this comment" is
    -- two reports, and letting it be one row would make the review queue's
    -- primary question ambiguous.
    CONSTRAINT content_reports_one_target CHECK (num_nonnulls(bookmark_id, comment_id) = 1)
);

-- The review queue reads oldest-open-first; this is that query.
CREATE INDEX idx_content_reports_open
    ON content_reports(created_at)
    WHERE status = 'open';

-- One report per person per thing. A second press of the button is not a
-- second signal, and without this a single account can flood the queue.
CREATE UNIQUE INDEX idx_content_reports_reporter_bookmark
    ON content_reports(reporter_id, bookmark_id)
    WHERE bookmark_id IS NOT NULL;

CREATE UNIQUE INDEX idx_content_reports_reporter_comment
    ON content_reports(reporter_id, comment_id)
    WHERE comment_id IS NOT NULL;

COMMENT ON TABLE content_reports IS
    'Reported content stays visible pending review. There is no auto-hide, because auto-hide is trivially weaponised (docs/functional-spec/06-social.md § Abuse and moderation).';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- docs/functional-spec/07-data-model.md § Row-level security:
-- `bookmark_comments` is "readable when the parent bookmark is public or owned
-- by the reader; writable by the comment's author".
--
-- The API connects as the service role and bypasses all of this. These
-- policies are what stands between a client talking to PostgREST or the
-- realtime channel directly and every private note anyone has left on their
-- own saves — commenting on a private bookmark is a note to self, and the read
-- policy below is the only thing keeping it one.
ALTER TABLE bookmark_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmark_comments_visible_select ON bookmark_comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookmarks b
            WHERE b.id = bookmark_comments.bookmark_id
              AND (b.is_public = true OR b.user_id = auth.uid())
        )
    );

-- Writable by the author, and only onto a bookmark they are allowed to see.
-- Both halves matter: without the second, anyone could seed a thread on a
-- private bookmark they cannot read.
CREATE POLICY bookmark_comments_author_insert ON bookmark_comments
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM bookmarks b
            WHERE b.id = bookmark_comments.bookmark_id
              AND (b.is_public = true OR b.user_id = auth.uid())
        )
    );

CREATE POLICY bookmark_comments_author_update ON bookmark_comments
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY bookmark_comments_author_delete ON bookmark_comments
    FOR DELETE
    USING (user_id = auth.uid());

-- A report is visible to the person who filed it and to nobody else. There is
-- no public moderation UI in this revamp, and a report list readable by the
-- reported party would make reporting unsafe.
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_reports_reporter_select ON content_reports
    FOR SELECT
    USING (reporter_id = auth.uid());

CREATE POLICY content_reports_reporter_insert ON content_reports
    FOR INSERT
    WITH CHECK (reporter_id = auth.uid());

-- No UPDATE or DELETE policy on purpose: a reporter cannot withdraw a report
-- and cannot edit one. Review status is moved by the service role.
