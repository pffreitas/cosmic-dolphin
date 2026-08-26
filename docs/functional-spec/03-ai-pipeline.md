# 03 · AI pipeline

What happens between a URL being saved and a bookmark being useful. Runs in `apps/worker` off pgmq;
all model calls live in `packages/shared/src/ai`.

## Phases

The durable timeline (`bookmark_processing_runs` / `bookmark_processing_events`) **exists**, with
per-phase token and cost accounting. This revamp fixes the phase vocabulary so the UI can label it,
and adds the filing phase.

| # | Phase | Status | Produces | User-facing label |
| --- | --- | --- | --- | --- |
| 1 | `fetch` | exists | Raw HTML in `scraped_url_contents`, Open Graph into `metadata` | Fetched page |
| 2 | `extract` | exists | Readable content, `wordCount`, `readingTime`, `cosmic_images`, `cosmic_links` | Extracted content |
| 3 | `summarise` | exists | `cosmic_brief_summary` (1–2 sentences), `cosmic_summary` (full brief), key points (new) | Summarising… |
| 4 | `tag` | exists | `cosmic_tags` | Tagging |
| 5 | `file` | **new** | `collection_id`, or a new-collection proposal | Filing into a collection |
| 6 | `embed` | exists | `content_chunks` with pgvector embeddings, `search_document` | *(not surfaced)* |

Phases 1–5 are surfaced in the UI. `embed` runs silently — it has no user-legible output and showing
it would pad the progress list with noise.

Phases are sequential and each is independently retryable. A failure in `summarise` does not prevent
`tag`, `file`, or `embed` from running on the extracted content.

## Outputs

**Brief summary** (`cosmic_brief_summary`, exists) — 1–2 sentences, ≤ 240 characters, declarative,
no hedging, no "This article discusses". Used in feed items and library rows.

**Full brief** (`cosmic_summary`, exists) — a paragraph plus **key points**. Key points are 2–5
findings, each ≤ 140 characters, and they are *findings, not a sequence* — the UI renders them with
a dot marker, never numbered. Store as a JSON array (new column `cosmic_key_points`) rather than
parsing markdown out of the summary at render time.

**Tags** (`cosmic_tags`, exists) — 2–5 lowercase topical tags. Reuse the user's existing tag
vocabulary before inventing new ones: pass the user's top 50 tags as candidates so the library
converges instead of fragmenting.

**Filing** (new) — see below.

**Provenance** — every output records the phase, model id, and source content it derived from. This
already flows into `bookmark_processing_events`; the UI reads it for "summarised from the full
article" and the digest's "Built from" line.

## Filing

The new `file` phase places the bookmark in the user's collection tree.

Given the user's existing tree, the bookmark's tags, and its brief summary, the model returns one of:

1. **An existing collection id** — the common case. Prefer an existing collection over creating one.
2. **A new collection proposal** — `{ name, parentId }`. Not created automatically. It lands in
   `collection_suggestions` (new) and surfaces in the Library rail as an AI callout with
   **Create** / **Not now**. A proposal needs at least 5 supporting bookmarks before it is offered.
3. **`null`** — leave in Inbox. The correct answer when the tree has no good home and there is not
   yet enough evidence for a new one. Inbox is a valid resting place, not a failure.

**The override rule.** When a user manually files a bookmark, set `filing_source = 'user'` (new).
The pipeline never moves a bookmark whose `filing_source` is `'user'`, on any subsequent run. This
is the difference between a system that helps and one the user has to fight.

## States

`bookmarks.processing_status` **exists**: `idle | processing | completed | failed`.

| State | Meaning | UI |
| --- | --- | --- |
| `processing` | A run is in flight | Staged progress inside a real row |
| `completed` | All surfaced phases succeeded | Normal item |
| `failed` | A surfaced phase exhausted its retries | Failed phase with **Retry**; the row stays usable |
| `idle` | No run has started, or a private link | Row with user-supplied content only |

**Partial success is normal and must be represented.** A bookmark whose `summarise` failed but whose
`extract` succeeded is `failed` overall, yet still shows its content, tags, and filing. The UI shows
the failed phase in place of the brief, not in place of the page.

## Retries

Transient failures (timeout, 5xx, rate limit) retry with exponential backoff up to 3 attempts inside
the worker. Permanent failures (404, 403, robots exclusion, unparseable content) fail immediately —
retrying them wastes tokens and delays the queue.

A manual **Retry** from the UI (`POST /bookmarks/{id}/reprocess`, new) starts a fresh run, optionally
scoped to one phase, and appends to the existing timeline rather than replacing it.

Concurrency against model providers is already bounded with `p-limit`; keep new phases inside the
same limiter.

## Progress delivery

The client learns about phase changes through the existing Supabase realtime subscription on the
bookmark row, plus `GET /bookmarks/{id}/processing-timeline` (exists) on mount and on reconnect.

Emit **one event per phase transition** — not per token. The UI is a four-line checklist; streaming
tokens into it produces flicker and burns realtime quota for no user benefit.

## Cost

`bookmark_processing_runs` already records input, output, reasoning, and cached tokens plus
`cost_usd` per run and per event. Two things to add:

- A per-user daily processing budget, enforced before enqueue. Over budget, the bookmark saves with
  `processing_status = 'idle'` and a **Summarise now** action on the row.
- Cost per phase surfaced in an internal-only view. Filing and tagging should be cheap models;
  summarising is the only phase that justifies a frontier model.
