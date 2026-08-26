# 06 · Social

Visible but secondary. Social affordances appear on every feed item and every public bookmark, and
nowhere in the Library.

## Privacy model

**Private by default.** A bookmark is visible only to its owner until the user explicitly shares it.

`bookmarks.is_public` and `share_slug` **exist**, with `PUT`/`DELETE /bookmarks/{id}/share`.

| Visibility | Who can see it | Where it appears |
| --- | --- | --- |
| Private (default) | Owner only | Owner's Library and Home |
| Public | Anyone with the link | `/s/{share_slug}`, followers' feeds, owner's public profile |

Making a bookmark public exposes: its title, source URL, Open Graph metadata, AI summary, key points,
tags, and its comment thread. It does **not** expose: the owner's collection placement, their read
state, their reading progress, their highlights, or their private notes. Those are theirs regardless
of the bookmark's visibility.

Un-sharing revokes the slug immediately, removes the bookmark from followers' feeds, and hides — but
does not delete — its comments, so re-sharing restores the thread.

A private link (`is_private_link`) can never be made public. Its content came from behind someone
else's auth wall.

## Follow

**New.** A directed edge: `follows(follower_id, following_id, created_at)`.

- Following is public and requires no approval. There are no private accounts in this revamp.
- Following someone puts their public saves into the follower's **For you** and **Following**
  scopes.
- Unfollowing is immediate and silent; the followed user is not notified.
- Blocking (`user_blocks`, new) removes both directions and hides the blocker's public saves from the
  blocked user.

Counts on the profile: followers, following, public saves, collections.

## Like

**Exists** — `bookmark_likes` with a unique `(user_id, bookmark_id)`, a denormalised
`bookmarks.like_count`, and `PUT`/`DELETE /bookmarks/{id}/like`.

Optimistic in the client, reconciled against the server response. A like is a **ranking input, not
an objective** — it feeds social proof at a capped weight and nothing else. Liking is available on
public bookmarks and digests; a user can like their own save.

Counts are hidden at zero and abbreviated above 4 digits.

## Comment

**New.** `bookmark_comments(id, bookmark_id, user_id, parent_id, body, created_at, updated_at,
deleted_at)`.

- One level of nesting. A reply to a reply attaches to the same parent — deep threads are where
  reading products turn into forums.
- Plain text plus links; no rich text, no images, no embeds. 2,000 character cap.
- Editable for 15 minutes, then frozen. Deleting soft-deletes and renders as *"Comment deleted"* if
  it has replies, hard-deletes if it does not.
- Available on public bookmarks and digests. Commenting on a private bookmark is a private note to
  self and is not shown to anyone else — same table, gated on `is_public`.
- Rate limited to 10 per minute per user.

**Placement.** Never inline in the feed. The feed's comment action opens a drawer on desktop and a
sheet on mobile; the detail page shows the thread in full beneath the content.

Ordering is chronological. There is no comment ranking, no "top comment", and no score.

## Reshare

**New.** The feed's **Save** action.

Resharing creates a *new bookmark owned by the resharing user*, with
`saved_from_bookmark_id` pointing at the original. It:

- inherits the source URL, and therefore hits the existing per-user URL uniqueness constraint —
  resharing something already in the library is a no-op that toasts "Already in your library";
- runs the full pipeline for the new owner, so the summary and filing reflect *their* tree, not the
  original owner's;
- appears in followers' feeds as a `reshare` item, crediting both the resharer and the original
  saver in the provenance row.

Deleting the original bookmark does not affect reshares. The provenance line degrades to the domain
alone.

## Profiles

**Exists** — `profiles(id, name, email, picture_url)`, synced from `auth.users`, with
`GET /profile`.

To add: a public profile route showing name, picture, join date, counts, and tabs for public saves,
public collections, and likes. `email` is never exposed on a public profile.

Handles (`profiles.handle`, new) give profiles a stable URL: `/u/{handle}`. Unique, 3–30 characters,
lowercase alphanumeric plus underscore, changeable once every 30 days.

## Abuse and moderation

Minimum viable, but not skippable given public content and comments:

- **Report** on any public bookmark or comment, writing to `content_reports` (new) with a reason.
- Reported content stays visible pending review; there is no auto-hide, because auto-hide is
  trivially weaponised.
- A per-user rate limit on public shares (100/day) and comments (10/min).
- An internal queue for review. No public moderation UI in this revamp.

## What is not in this revamp

Notifications of any kind — in-app, push, or email. Direct messages. Shared or collaborative
collections. Quote-resharing with commentary. Follower-only visibility. Each of these deserves its
own decision, and shipping them implicitly with the feed would be the fastest way to turn a calm
reading network into a social network.
