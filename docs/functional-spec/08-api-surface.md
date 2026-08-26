# 08 · API surface

Contract-first. **Every endpoint change starts in `packages/apispec/*.tsp`**, then
`bun run apispec` regenerates the OpenAPI document and the TypeScript client. Never hand-edit
`packages/api-client` — it is generated.

Handlers live in `apps/api/src/routes/`, validate with Zod, and authenticate with the existing
Supabase JWT middleware. Business logic and all model calls belong in `packages/shared`.

## Exists — keep

| Route | Notes |
| --- | --- |
| `POST /bookmarks` | Add `alreadySaved` to the response for the dedupe path. |
| `GET /bookmarks` | Library list. Add `sort` and cursor pagination. |
| `GET /bookmarks/{id}` | Detail. |
| `DELETE /bookmarks/{id}` | |
| `GET /bookmarks/feed` | **Behaviour replaced** — see below. |
| `GET /bookmarks/{id}/processing-timeline` | Powers staged progress. |
| `PUT`/`DELETE /bookmarks/{id}/read` | Read state. |
| `PUT`/`DELETE /bookmarks/{id}/like` | Likes. |
| `PUT`/`DELETE /bookmarks/{id}/share` | Public sharing and slug. |
| `POST /bookmarks/preview` | Optimistic capture metadata. |
| `GET /bookmarks/search`, `GET /search`, `POST /search/ask` | Literal, semantic, and question search. |
| `GET /bookmarks/shared/{slug}` | Public shared view. |
| `GET /collections` | Tree. |
| `GET /profile` | Current user. |

## Changed

### `GET /bookmarks/feed`

```
GET /bookmarks/feed?scope=for_you|following|unread&cursor=&limit=20
```

Returns ranked items, not raw bookmarks:

```ts
model FeedItem {
  type: "own_save" | "followed_save" | "reshare" | "digest" | "pending";
  bookmark?: Bookmark;
  digest?: FeedDigest;
  actor?: PublicProfile;          // who shared or reshared
  rankingReason?: string;         // "Why this appeared", server-generated
  signals?: RankingSignal[];      // debugging; omitted in production responses
}
model FeedResponse { items: FeedItem[]; nextCursor?: string; computedAt: utcDateTime; }
```

Cursor-based, never offset — the set is re-ranked between requests, so offsets duplicate and skip.
`rankingReason` is generated server-side from the top two contributing signals; the client must not
synthesise it.

### `GET /bookmarks`

Add `sort` (`newest` | `oldest` | `recently_read` | `longest_unread`) and cursor pagination.
`read_status` and `collection_id` already exist.

## New

### Collections

```
POST   /collections                     create
PATCH  /collections/{id}                rename, recolour, reparent
DELETE /collections/{id}                bookmarks move to Inbox, never deleted
PATCH  /bookmarks/{id}/collection       manual refile; sets filing_source = 'user'
GET    /collections/suggestions         pending AI proposals
POST   /collections/suggestions/{id}/accept
POST   /collections/suggestions/{id}/dismiss
```

`PATCH /bookmarks/{id}/collection` is the override endpoint. It must set `filing_source = 'user'` in
the same transaction as the move — a refile that the pipeline can undo on its next run is worse than
no refile at all.

### Processing

```
POST /bookmarks/{id}/reprocess          body: { phase?: "summarise" | "tag" | "file" }
```

Starts a fresh run, appending to the existing timeline rather than replacing it.

### Reading

```
PUT  /bookmarks/{id}/progress           body: { percent, scrollOffset }
GET  /bookmarks/continue-reading        in-progress saves for the Home rail
```

`PUT progress` is high-frequency: throttle to one write per 5s per bookmark in the client, and make
the handler idempotent and cheap. Percent is monotonic server-side — reject a value lower than the
stored one rather than trusting the client.

### Highlights

```
GET    /bookmarks/{id}/highlights
POST   /bookmarks/{id}/highlights       body: { quote, prefix, suffix, note? }
PATCH  /highlights/{id}                 note only
DELETE /highlights/{id}
```

### Comments

```
GET    /bookmarks/{id}/comments?cursor=
POST   /bookmarks/{id}/comments         body: { body, parentId? }
PATCH  /comments/{id}                   within 15 minutes of creation
DELETE /comments/{id}                   soft-delete when it has replies
```

One level of nesting: a `parentId` pointing at a reply attaches to that reply's parent instead.
Rate limited to 10/min per user.

### Social graph

```
PUT    /users/{handle}/follow
DELETE /users/{handle}/follow
GET    /users/{handle}                  public profile
GET    /users/{handle}/saves            public saves, paginated
GET    /users/{handle}/followers
GET    /users/{handle}/following
PATCH  /profile                         name, picture, handle (once per 30 days)
PUT    /users/{handle}/block
DELETE /users/{handle}/block
```

Routes key on `handle`, not `id`, so profile URLs are stable and shareable. `email` is never present
in a `PublicProfile`.

### Reshare

```
POST /bookmarks/{id}/reshare
```

Creates a new bookmark owned by the caller with `saved_from_bookmark_id` set, and runs the pipeline
for the new owner. Returns `alreadySaved: true` when the caller already has that URL.

### Feed feedback

```
POST /feed/feedback   body: { kind, bookmarkId?, domain?, topic? }
```

Takes effect on the next feed request. Dismissal must be visibly honoured — a returning item is a
bug, not a ranking nuance.

### Digests

```
GET    /digests/{id}
PUT    /digests/{id}/like     DELETE likewise
PUT    /digests/{id}/share    DELETE likewise
```

Digests are first-class social objects: likeable, commentable, shareable. Resharing a digest saves
the digest, not its sources.

### Reports

```
POST /reports   body: { bookmarkId? | commentId?, reason }
```

## Conventions

- Cursor pagination on every list that can grow: feed, comments, saves, followers.
- `PUT` for idempotent toggles (like, follow, read, share); `POST` for creation; `PATCH` for partial
  updates.
- Errors use the existing `CosmicError { code, message }`. 404 rather than 403 for objects the caller
  cannot see — existence is itself information.
- Every mutation is authenticated. Only `GET /bookmarks/shared/{slug}` and `GET /users/{handle}`
  serve unauthenticated requests, and both return public fields only.
- Rate limits: 429 with `Retry-After`. Saves 100/day, comments 10/min, follows 100/hour.
