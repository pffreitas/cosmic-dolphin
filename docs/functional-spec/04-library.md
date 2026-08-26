# 04 · Library

The personal archive. Saved-link first, chronological by default, AI-organised, private.

No likes, no comments, no counts, no social context anywhere on this surface. A user's Library is
theirs.

## Ordering

**Chronological by `created_at` descending is the default and always reachable in one click.** AI
organisation is an overlay on that order, never a replacement.

Sort options: Newest, Oldest, Recently read, Longest unread. Sort is per-user sticky, stored client
side.

## Collections

`collections` **exists** — hierarchical via `parent_id`, owned by `user_id`, with `name`,
`description`, `color`, `icon`, `is_public`.

The tree in the Library rail:

```
All saves          — every non-archived bookmark, chronological
Inbox              — collection_id IS NULL; nothing filed yet
<AI + user collections, nested to 2 levels>
Read later         — a saved filter, not a collection: read_at IS NULL
Archive            — is_archived = true, collapsed by default
```

Depth is capped at **two levels**. A third level is where folder systems start to fail people, and
the AI has no way to justify one.

Operations: create, rename, recolour, move (reparent), delete. Deleting a collection moves its
bookmarks to Inbox — it never deletes bookmarks. Every one of these is available whether the
collection was created by AI or by hand.

### AI filing, from the user's side

The collection breadcrumb on a library row is the AI's decision, rendered as a clickable path. The
user changes it by dragging the row onto a tree node, or through the row's overflow menu.

Any manual placement sets `filing_source = 'user'` and is permanent — see
[03-ai-pipeline.md](./03-ai-pipeline.md#filing).

**Collection suggestions** (new) appear in the rail as an AI callout when at least 5 unfiled or
loosely-filed bookmarks cluster around a topic: *"9 saves look like a new collection: Typography &
reading UX"* with **Create** / **Not now**. Dismissal is remembered; the same suggestion is not
re-offered for 30 days.

## Read state

`bookmarks.read_at` **exists**, along with `PUT`/`DELETE /bookmarks/{id}/read` and the
`BookmarkReadStatus` filter (`all` / `unread` / `read`).

- Unread is a 6px accent dot at the row's leading edge. Read rows keep a transparent spacer so
  titles stay aligned — the list must not shift when something is marked read.
- Marking read is manual and explicit. The system may *suggest* it at 90% reading progress with an
  undoable toast, but never sets it silently.
- The read-status segmented control is per-collection and persists in the URL
  (`?read_status=unread`), so a filtered view is shareable and survives a refresh.

## Reading progress

**New.** Powers Home's "Continue reading" rail and the read suggestion above.

`bookmark_reading_progress(user_id, bookmark_id, percent, scroll_offset, updated_at)`. The client
writes at most once every 5 seconds while the reader is visible, and once on unmount. Percent is
derived from scroll position over extracted-content height, clamped to 0–100 and monotonic — it
never goes down, because a user scrolling back up has not un-read anything.

A bookmark is *in progress* at 5–95%. Below 5% it is unstarted; above 95% it offers to be marked
read.

## Highlights

**New.** A user-selected span inside extracted content.

`bookmark_highlights(id, user_id, bookmark_id, quote, prefix, suffix, note, created_at)`. Anchoring
uses the quoted text plus a short prefix/suffix rather than character offsets, so a re-extraction
does not orphan every highlight.

Selecting text shows a small popover: **Highlight**, **Copy**, **Comment**. Highlights render with
`--cd-hl-bg` and are listed in the detail page's action row as a count. They are private even on a
public bookmark.

## Search

Two mechanisms already exist and both stay:

- **Literal** — `search_document` with Postgres full-text, across title, summary, and tags.
- **Semantic** — `content_chunks` with pgvector, over extracted content.

`GET /search` (exists) runs both and merges. Results render as library rows with the matched span
highlighted; semantic-only hits carry a `Related` neutral tag so a result without a visible keyword
match explains itself.

`POST /search/ask` (exists) answers a question over the user's library. Its answer is an AI callout
and is bound by the same rule as every other AI output: it names the bookmarks it drew from, and
each is a link.

Search is scoped to the user's own library. Searching other people's public saves is Explore's job,
not this one.

## Bulk operations

**New.** Shift-click range selection on library rows, with a bar offering: refile, mark read/unread,
add tag, archive, delete. Every bulk action is undoable for 8 seconds via the toast; delete is the
only one that asks for confirmation.

## Archive vs delete

`is_archived` **exists**. Archiving removes a bookmark from All saves, Inbox, and the feed, keeps it
searchable, and is reversible. Deleting is permanent, cascades to likes, comments, highlights, and
chunks, and is confirmed in a dialog naming the title.
