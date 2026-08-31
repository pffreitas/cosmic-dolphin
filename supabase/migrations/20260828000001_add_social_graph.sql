-- Social graph: handles, follows, blocks.
--
-- Three things land together because they are one idea:
--
--   1. `profiles.handle` — a stable, shareable public identity. Profile URLs
--      are `/u/{handle}` and every social route keys on the handle rather than
--      the uuid, so a profile link survives being pasted into a chat window
--      (docs/functional-spec/06-social.md § Profiles).
--   2. `follows` — a directed edge, no approval, no reciprocity. This is the
--      only thing the feed's `following` and `for_you` scopes stand on.
--   3. `user_blocks` — the counterweight. A block removes both follow edges
--      and hides the blocker's public saves from the blocked user.
--
-- Handle claim for existing accounts (plan § Open decisions #2): every profile
-- gets a *reserved* handle derived from its email local part, with
-- `handle_claimed_at` left NULL to mark it as never confirmed by a human. The
-- API reports that as `handleClaimed: false` and the web app prompts once. A
-- reserved handle is a real handle in every other respect — `/u/{handle}`
-- works from the moment this migration runs, and `/my/profile` keeps working
-- throughout because nothing about it is required.

-- ---------------------------------------------------------------------------
-- profiles.handle
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
    -- Nullable on purpose. A profile row is created by a trigger on
    -- `auth.users`, and sign-in must not be able to fail because a handle
    -- could not be minted. NULL is the degraded state, not the normal one.
    ADD COLUMN handle text,

    -- When the handle last *changed*. NULL means it never has — the reserved
    -- handle was assigned by this migration or by the signup trigger, which is
    -- not a change the user made and must not consume their 30-day allowance.
    ADD COLUMN handle_changed_at timestamptz,

    -- When a human confirmed the handle. NULL means "reserved, unclaimed":
    -- the value in `handle` is a guess derived from an email address and the
    -- user has never been asked about it.
    ADD COLUMN handle_claimed_at timestamptz;

-- The format rule from docs/functional-spec/06-social.md, enforced where it
-- cannot be forgotten. Lowercase only: a handle that differs from another only
-- by case is an impersonation vector, and case-folding at read time would make
-- the unique index useless.
ALTER TABLE profiles
    ADD CONSTRAINT profiles_handle_format
    CHECK (handle IS NULL OR handle ~ '^[a-z0-9_]{3,30}$');

-- A unique *index* rather than a unique constraint, because it has to tolerate
-- many NULLs — every profile is briefly handle-less between the ALTER above
-- and the backfill below, and a profile whose handle could not be minted stays
-- that way.
CREATE UNIQUE INDEX profiles_handle_key ON profiles (handle);

COMMENT ON COLUMN profiles.handle IS
    'Public identity, unique, ^[a-z0-9_]{3,30}$. Changeable once per 30 days once claimed.';
COMMENT ON COLUMN profiles.handle_claimed_at IS
    'NULL means the handle was reserved from the email local part and never confirmed by the user. The API reports this as handleClaimed: false.';
COMMENT ON COLUMN profiles.handle_changed_at IS
    'NULL means the handle has never been changed by a human, so the first change is free. Otherwise the 30-day cooldown runs from here.';

-- ---------------------------------------------------------------------------
-- Reserving a handle from an email address
-- ---------------------------------------------------------------------------

-- Deterministic, and collision-safe by construction.
--
-- The email local part is *not* unique — two people can be `paulo@a.com` and
-- `paulo@b.com` — so the derivation cannot stop at "lowercase the local part".
-- The rule is: first come, bare handle; everyone after gets `_2`, `_3`, … in
-- order of account age. Because the backfill walks profiles by
-- `(created_at, id)`, the same database always produces the same assignment.
--
-- The candidate is checked against the table rather than against the base
-- alone, so `paulo_2` derived from a collision cannot collide with a
-- `paulo_2@…` who was there first.
CREATE OR REPLACE FUNCTION public.reserved_handle_for(p_email text, p_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    base text;
    candidate text;
    suffix int := 2;
    suffix_text text;
BEGIN
    base := lower(coalesce(split_part(coalesce(p_email, ''), '@', 1), ''));
    -- Everything outside the alphabet becomes an underscore: dots and plus
    -- addressing are the common cases (`first.last+news@…`).
    base := regexp_replace(base, '[^a-z0-9_]', '_', 'g');
    base := regexp_replace(base, '_{2,}', '_', 'g');
    base := trim(both '_' from base);

    -- No usable email, or a local part that was entirely punctuation. The uuid
    -- prefix is not pretty, and it is unique, which matters more for something
    -- the user is about to be asked to replace.
    IF base = '' THEN
        base := 'user_' || substr(replace(p_id::text, '-', ''), 1, 8);
    END IF;

    IF length(base) < 3 THEN
        base := rpad(base, 3, '_');
    END IF;

    base := left(base, 30);
    candidate := base;

    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate) LOOP
        suffix_text := suffix::text;
        -- Trim the base, never the suffix: `_2` truncated away would loop
        -- forever on a 30-character local part.
        candidate := left(base, 30 - length(suffix_text) - 1) || '_' || suffix_text;
        suffix := suffix + 1;

        IF suffix > 10000 THEN
            candidate := left('user_' || replace(p_id::text, '-', ''), 30);
            EXIT;
        END IF;
    END LOOP;

    RETURN candidate;
END;
$$;

COMMENT ON FUNCTION public.reserved_handle_for(text, uuid) IS
    'Derives an unclaimed handle from an email local part. Collisions resolve to _2, _3, ... in account-age order, checked against profiles.handle so a derived candidate cannot steal a real one.';

-- Backfill, oldest account first: the earliest `paulo@…` keeps `paulo`.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, email FROM public.profiles WHERE handle IS NULL
        ORDER BY created_at, id
    LOOP
        UPDATE public.profiles
        SET handle = public.reserved_handle_for(r.email, r.id)
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- New signups need one too, or `/u/{handle}` would 404 for everyone who joined
-- after this migration. Handle assignment is a *separate statement* from the
-- profile upsert and swallows a unique violation: two people signing up in the
-- same second with the same local part would otherwise race for one candidate
-- and one of them would fail to sign in. A missing handle is recoverable; a
-- failed sign-in is not.
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS TRIGGER AS $$
DECLARE
    attempt int;
BEGIN
    INSERT INTO public.profiles (id, name, email, picture_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, profiles.name),
        email = COALESCE(EXCLUDED.email, profiles.email),
        picture_url = COALESCE(EXCLUDED.picture_url, profiles.picture_url),
        updated_at = NOW();

    FOR attempt IN 1..5 LOOP
        BEGIN
            UPDATE public.profiles
            SET handle = public.reserved_handle_for(NEW.email, NEW.id)
            WHERE id = NEW.id AND handle IS NULL;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            -- Someone took the candidate between the SELECT inside
            -- reserved_handle_for and this UPDATE. Ask again; it will now see
            -- the taken row. plpgsql needs a statement here, not just a
            -- comment.
            NULL;
        END;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------

-- A directed edge and nothing else. No `status`, no `approved_at`: there are no
-- private accounts in this revamp, so a follow has exactly two states —
-- the row exists or it does not. Adding a state column now would be inventing a
-- product decision the spec explicitly declined
-- (docs/functional-spec/06-social.md § Follow).
CREATE TABLE follows (
    follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- The primary key *is* the idempotency: following twice is one row, so
    -- a double-tapped button cannot inflate a follower count.
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

-- The primary key already serves "who does this user follow". This is the
-- other direction — "who follows this user" — which the follower list and the
-- follower count both need, and which a leading-column index cannot answer.
CREATE INDEX idx_follows_following ON follows(following_id);

COMMENT ON TABLE follows IS
    'Directed, reciprocity-free, no approval. A follow is immediate: the row exists or it does not.';

-- ---------------------------------------------------------------------------
-- user_blocks
-- ---------------------------------------------------------------------------

CREATE TABLE user_blocks (
    blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

-- "Is the caller blocked by this author?" is asked on every public profile
-- read and every public-saves listing, and it looks up by `blocked_id`, which
-- the primary key cannot serve.
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

COMMENT ON TABLE user_blocks IS
    'Blocking drops both follow edges in the same transaction and hides the blocker''s public saves from the blocked user. Enforced in the social service, not by a route guard.';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- docs/functional-spec/07-data-model.md § Row-level security: `follows` and
-- `user_blocks` are "readable by either party, writable only by the acting
-- user".
--
-- The API connects as the service role and bypasses all of this. These
-- policies are what stands between a client that talks to PostgREST or the
-- realtime channel directly and the whole graph. Public follower *lists* are
-- served by the API from the service role, which is why the policies here can
-- be this tight without breaking anything the product does.
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY follows_either_party_select ON follows
    FOR SELECT
    USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Only the follower writes the edge. Nobody can make someone else follow them.
CREATE POLICY follows_follower_insert ON follows
    FOR INSERT
    WITH CHECK (follower_id = auth.uid());

CREATE POLICY follows_follower_delete ON follows
    FOR DELETE
    USING (follower_id = auth.uid());

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_blocks_either_party_select ON user_blocks
    FOR SELECT
    USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

CREATE POLICY user_blocks_blocker_insert ON user_blocks
    FOR INSERT
    WITH CHECK (blocker_id = auth.uid());

CREATE POLICY user_blocks_blocker_delete ON user_blocks
    FOR DELETE
    USING (blocker_id = auth.uid());
