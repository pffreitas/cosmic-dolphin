# 07 · Data model

What exists in `supabase/migrations/`, and what this revamp adds. Migrations run in the backend
deploy pipeline before new containers start — see `.github/workflows/deploy-backend.yml`.

## Exists — do not rebuild

| Table | Notes |
| --- | --- |
| `bookmarks` | `source_url`, `title`, `metadata` jsonb, `collection_id`, `user_id`, `is_archived`, `is_favorite`, `created_at`, `updated_at`. AI columns: `cosmic_summary`, `cosmic_brief_summary`, `cosmic_tags[]`, `cosmic_images`, `cosmic_links`. Processing: `processing_status` enum, `processing_started_at`, `processing_completed_at`, `processing_error`. Social: `like_count`, `is_public`, `share_slug`. Also `is_private_link`, `read_at`. Unique on `(user_id, source_url)`. |
| `collections` | Hierarchical via `parent_id`, with `name`, `description`, `color`, `icon`, `user_id`, `is_public`. |
| `profiles` | `id` → `auth.users`, `name`, `email`, `picture_url`. Kept in sync by the `handle_auth_user_change` trigger. |
| `bookmark_likes` | Unique `(user_id, bookmark_id)`, cascades from `bookmarks`. |
| `scraped_url_contents` | Raw fetched content. |
| `content_chunks` | pgvector embeddings for semantic search. |
| `bookmark_processing_runs` | One row per pipeline run, with token and cost accounting. |
| `bookmark_processing_events` | Per-phase and per-turn spans, `kind IN (run, phase, turn)`, unique `(run_id, sequence)`. |
| pgmq queues | The bookmark processing queue. Do not add another broker. |

`bookmark_tags` predates `cosmic_tags[]` and appears vestigial. Confirm before touching it; if
unused, drop it in its own migration rather than as a side effect of this work.

## New

Grouped by the document that specifies the behaviour.

### Filing — [03](./03-ai-pipeline.md)

```sql
ALTER TABLE bookmarks
  ADD COLUMN cosmic_key_points jsonb,
  ADD COLUMN filing_source text NOT NULL DEFAULT 'ai'
    CHECK (filing_source IN ('ai', 'user')),
  ADD COLUMN saved_from_bookmark_id uuid REFERENCES bookmarks(id) ON DELETE SET NULL;

CREATE TABLE collection_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  bookmark_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed')),
  dismissed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_suggestions_user_status
  ON collection_suggestions(user_id, status);
```

`filing_source = 'user'` is the override flag: the pipeline must never move a bookmark carrying it.

### Reading — [04](./04-library.md)

```sql
CREATE TABLE bookmark_reading_progress (
  user_id uuid NOT NULL,
  bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  percent smallint NOT NULL DEFAULT 0 CHECK (percent BETWEEN 0 AND 100),
  scroll_offset integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bookmark_id)
);
CREATE INDEX idx_reading_progress_in_flight
  ON bookmark_reading_progress(user_id, updated_at DESC)
  WHERE percent BETWEEN 5 AND 95;

CREATE TABLE bookmark_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  quote text NOT NULL,
  prefix text,
  suffix text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookmark_highlights_bookmark ON bookmark_highlights(bookmark_id, user_id);
```

Highlights anchor on quoted text plus surrounding context, not character offsets, so re-extraction
does not orphan them.

### Social — [06](./06-social.md)

```sql
ALTER TABLE profiles
  ADD COLUMN handle text UNIQUE
    CHECK (handle ~ '^[a-z0-9_]{3,30}$'),
  ADD COLUMN handle_changed_at timestamptz;

CREATE TABLE follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);

CREATE TABLE user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE bookmark_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES bookmark_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_bookmark_comments_bookmark
  ON bookmark_comments(bookmark_id, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE bookmarks ADD COLUMN comment_count integer NOT NULL DEFAULT 0;

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  bookmark_id uuid REFERENCES bookmarks(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES bookmark_comments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(bookmark_id, comment_id) = 1)
);
```

`comment_count` is denormalised like `like_count` already is, maintained by trigger. The feed reads
both on every item; a count query per item does not survive contact with a 20-item page.

### Feed — [05](./05-feed.md)

```sql
CREATE TABLE feed_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  key_points jsonb NOT NULL,
  bookmark_ids uuid[] NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  share_slug varchar(12) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_digests_user_created ON feed_digests(user_id, created_at DESC);

CREATE TABLE feed_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('not_interested', 'fewer_domain', 'mute_topic')),
  bookmark_id uuid REFERENCES bookmarks(id) ON DELETE CASCADE,
  domain text,
  topic text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_feedback_user ON feed_feedback(user_id, kind);

CREATE TABLE feed_impressions (
  user_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('bookmark', 'digest')),
  item_id uuid NOT NULL,
  served_count smallint NOT NULL DEFAULT 1,
  opened_at timestamptz,
  last_served_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_type, item_id)
);
```

`feed_impressions` is what makes seen-decay possible: without it the ranker re-serves the same
unopened item forever. Keep it narrow and prune rows older than 60 days — it is the highest-write
table in this set.

The user interest vector is derived, not stored: the mean embedding of bookmarks the user finished
in the last 60 days, computed from `content_chunks` and cached in the API for the duration of a
request.

## Row-level security

Every new table carries RLS consistent with the existing model:

- `bookmark_reading_progress`, `bookmark_highlights`, `feed_feedback`, `feed_impressions`,
  `collection_suggestions` — owner only, on both read and write.
- `follows`, `user_blocks` — readable by either party, writable only by the acting user.
- `bookmark_comments` — readable when the parent bookmark is public or owned by the reader; writable
  by the comment's author.
- `feed_digests` — owner only unless `is_public`.

## Indexing note

The feed's candidate query is the one new hot path. It needs a covering index on public saves by
author and recency:

```sql
CREATE INDEX idx_bookmarks_public_recent
  ON bookmarks(user_id, created_at DESC)
  WHERE is_public = true AND is_archived = false;
```

The existing `idx_bookmarks_user_unread` already covers the own-saves half.
