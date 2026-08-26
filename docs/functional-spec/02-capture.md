# 02 · Capture

Saving a link. The single most-used action in the product, and the one where latency is least
acceptable.

## Rule

**Saving never blocks.** The POST that creates a bookmark returns as soon as the row is written and
enqueued. Everything else — fetching, extraction, summarising, tagging, filing — happens in the
worker and streams into a row that is already on screen.

## Entry points

| Entry point | Status | Behaviour |
| --- | --- | --- |
| Header **Save a link** | exists (restyle) | Opens a URL field in a dialog. `⌘V` into an empty field submits on paste. |
| Command palette | exists | Typing a URL surfaces "Save this link" as the first action. |
| `/my/library` empty state | new | The URL field is the empty state's primary action. |
| Feed **Save** action | new | Reshare — see [06-social.md](./06-social.md#reshare). |
| Browser extension / share sheet | out of scope | Endpoints should not assume a web-only client. |

## Create

`POST /bookmarks` — **exists**. Accepts `source_url`, optional `collection_id`, `title`,
`description`, `tags`, `is_private_link`.

On receipt, in order:

1. **Normalise the URL** (new). Lowercase scheme and host, strip trailing slash, drop tracking
   parameters (`utm_*`, `fbclid`, `gclid`, `ref`, `mc_cid`). Store the normalised form in
   `source_url` and preserve what the user pasted in `metadata.originalUrl`.
2. **Dedupe.** `bookmarks(user_id, source_url)` is already unique. On collision, do not error —
   return the existing bookmark with `alreadySaved: true` (new field) so the client can toast
   "Already in your library" with a link to it.
3. **Insert** with `processing_status = 'processing'`, `collection_id = NULL` (Inbox).
4. **Enqueue** onto the existing pgmq bookmark queue.
5. **Return** the bookmark. Target p95 under 300ms.

The client renders a `pending` feed item or library row immediately from the response.

## Optimistic display

Before the response arrives, the client shows a row built from the pasted URL alone: the domain and
a favicon chip in the provenance line, the URL as a provisional title, and staged progress at
*Fetching page*. If the request fails, that row turns into an inline error with **Retry** — it is
never silently removed.

`POST /bookmarks/preview` — **exists** — can fill in a real title and image before the save
completes. Use it opportunistically; never wait on it.

## Private links

**Exists** (`is_private_link`). A URL behind auth that the fetcher cannot read.

The user marks it at save time, or the pipeline marks it after a 401/403/paywall detection (new).
The bookmark is stored with whatever the user supplies — title, notes, tags — and the pipeline skips
extraction and summarising. The UI shows a `--cd-warning` note explaining that the page could not be
read, and the AI callout is replaced by an invitation to add the user's own summary.

A private-link bookmark cannot be made public.

## Failure

| Failure | Behaviour |
| --- | --- |
| Malformed URL | Reject at the field with inline validation before submit. |
| Unreachable host | The bookmark is still created. The pipeline records the failure; the row shows a failed phase with **Retry**. The original link always opens. |
| Duplicate | Not an error. See dedupe above. |
| Rate limit | 429 with a `Retry-After`. The client keeps the URL in the field and shows the wait. |

A save is never lost because the AI failed. The row and the URL are the durable part; everything the
pipeline adds is an enrichment that can be retried.
