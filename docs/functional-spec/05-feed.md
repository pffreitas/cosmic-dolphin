# 05 · Home feed

The ranked social feed. The surface that answers *what should I read now*.

Today `GET /bookmarks/feed` **exists** but returns the user's own unread bookmarks in reverse
chronological order. This revamp replaces its behaviour while keeping the route.

## Objective

**Personal usefulness first, social proof second.**

The feed optimises for links the user will open and finish. It does not optimise for time on site,
scroll depth, or likes. Concretely, the ranker is tuned against **completed reads**, not clicks —
a link that is opened and abandoned is a ranking failure, not a success.

## Scopes

A segmented control, always with a default selected:

| Scope | Contents |
| --- | --- |
| **For you** (default) | Own unread saves, saves from followed users, and AI digests, ranked. |
| **Following** | Only saves from followed users, ranked. |
| **Unread** | Only the user's own unread saves, chronological. No ranking, no social items. |

## Item types

| Type | Source | Frequency cap |
| --- | --- | --- |
| `own_save` | The user's own unread bookmark | — |
| `followed_save` | A public bookmark from someone the user follows | — |
| `reshare` | A followed user resharing a bookmark | — |
| `digest` | An AI-authored grouping of the user's own saves | 1 per 8 items, max 3 per session |
| `pending` | A save still processing | Always first, never ranked |

`pending` items are pinned to the top of the feed regardless of score, because the user just created
them and expects to see them.

## Ranking

Score per candidate, computed at request time over a bounded candidate set (own unread from the last
90 days, followed public saves from the last 14 days, plus eligible digests). Cap the candidate set
at 500 and rank in the API, not the database — the signals need the user's tag vector, which is
cheap to hold in memory and awkward in SQL.

| Signal | Weight | Definition |
| --- | --- | --- |
| **Topic affinity** | 0.35 | Cosine similarity between the bookmark's embedding and the user's interest vector (mean of the embeddings of bookmarks they finished in the last 60 days). |
| **Source affinity** | 0.15 | The user's historical open-and-finish rate for this domain. |
| **Recency** | 0.20 | Exponential decay, 7-day half-life on `created_at`. |
| **Social proof** | 0.15 | Saves and likes from followed users, log-scaled, capped so no item can win on popularity alone. |
| **Effort fit** | 0.10 | Match between `readingTime` and the user's typical finished length, by time of day. |
| **Novelty** | 0.05 | Penalty for domains or topics already dominant in the last 20 items served. |

Then apply, in order:

1. **Author diversity** — at most 2 consecutive items from one person or domain.
2. **Digest spacing** — enforce the frequency cap above.
3. **Seen decay** — an item served but not opened in the last 3 sessions is multiplied by 0.6; after
   5 it is dropped from For you and remains reachable in Unread.

The exact weights are a starting point, not a contract. They belong in configuration, not in
scattered constants, so they can be tuned without a deploy.

### What is deliberately absent

No engagement-time signal. No "trending" boost. No penalty for leaving the app. No feed item that
exists to promote the product. A ranker that cannot explain itself in one sentence has a bug.

## Why this appeared

**Mandatory on every ranked item.** A `<details>` disclosure that expands into one sentence in plain
second-person language, generated from the top two contributing signals:

> "You saved three links about agent memory this week, and you open 7 of every 10 links Maya shares."

The API returns the reason with the item (`rankingReason: string`, plus `signals: {name, weight}[]`
for debugging). It is never generated client-side from a template — the client cannot know what the
ranker actually weighted, and a plausible-sounding wrong answer is worse than none.

## Digests

An AI-authored feed item that groups 3–6 of the user's own recent saves into a single observation:
*"Four of your saves are circling the same argument."*

Generated on a schedule per user (not per request) by the worker, clustering the last 14 days of
saves by embedding proximity and asking the model for a thesis plus 2–3 key points **only when the
cluster is genuinely coherent**. A weak cluster produces no digest. Stored in `feed_digests` (new).

A digest carries the same obligations as any AI output: a `Built from` provenance row listing its
source bookmarks as links, and its own social action row — it is shareable and likeable, and
resharing it saves the digest, not its sources.

## Feedback

Each item's overflow menu offers **Not interested**, **Fewer from this domain**, and **Mute topic**.
These write to `feed_feedback` (new) and take effect on the next request, visibly — an item the user
dismissed does not come back. Dismissal is a stronger signal than any positive one: weight it at
3× the equivalent positive.

## Delivery

`GET /bookmarks/feed?scope=&cursor=&limit=` returns items with a `nextCursor`. Cursor-based, not
offset — the set is re-ranked between requests and offsets would duplicate and skip.

Page size 20. Infinite scroll with a skeleton sentinel. A "Updated *n* min ago" line reflects when
the ranking was computed; a pull-to-refresh or a click recomputes.

Cache the ranked head of the feed per user for 5 minutes. Newly saved bookmarks bypass the cache and
are prepended.
