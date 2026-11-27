# Summary setup experiments: context for the next session

Written 2026-11-27 at the end of the save summary quality work on `feat/save-summary-quality`. This is a briefing, not a spec. The next session runs its own spec process. Paths are under `packages/shared/src/` unless they start with `apps/`, `docs/` or `supabase/`.

The owner's goal, in their words: "build calibration into the product, we will then use different models and even summarization prompts and pipelines and use user feedback (engagement) to promote or demote model + pipeline setups."

## The pipeline after this branch

A save runs six phases in order: `fetch`, `extract`, `summarise`, `tag`, `file` and `embed` (`services/bookmark-processing-reporter.service.ts:30`).

- **Model.** `BOOKMARK_MODEL_IDS` reads `BOOKMARK_MODEL_LARGE` and `BOOKMARK_MODEL_SMALL` once, at import (`services/bookmark.model-ids.ts:1`). `large` defaults to `anthropic/claude-haiku-5.5` (D-19) and writes summaries and digests (`services/digest.service.ts:548`). `small` stays `openai/gpt-6-luna` for tags (`services/bookmark.processor.service.ts:1000`), image filtering (`:1152`) and filing (`services/bookmark.filing.service.ts:201`).
- **Provider options.** `summaryProviderOptions` sends `require_parameters` and adds low reasoning effort only for Luna (`services/bookmark.model-ids.ts:8`). The processor applies it to both summary turns (`services/bookmark.processor.service.ts:895`). The digest call sends no options.
- **Kind.** `prepareContent` picks `link_post` for an X post with a complete follow, `tweet` for other X posts, `youtube`, or `article` (`services/bookmark.processor.service.ts:1027`).
- **Prompt.** `buildSummarisePrompt` builds one prompt from the kind, the linked source and the display limits (`services/bookmark.processor.prompt.ts:88`). Kind guidance is at `:65` and limits at `:59`. The D-20 teaser rule is at `:123`.
- **Fallbacks.** A `link_post` turn that returns `unusable` persists a post-only row and reruns as `tweet` (`services/bookmark.processor.service.ts:429`). An incomplete object gets one brief-only turn (`:928`). An unusable standalone source fails with a code such as `paywall` (`:960`).

Each summarise turn is a `bookmark_processing_events` row of kind `turn` (`database/schema.ts:388`). It stores `model_id`, tokens, `cost_usd`, `duration_ms` and `metadata` (`services/bookmark-processing-reporter.service.ts:344`). The metadata holds `kind`, `truncated`, `originalChars`, `linkedUrl`, `linkedStatus`, `contentStatus`, `unusableReason` and `briefOnly` (`services/bookmark.processor.service.ts:897`). `bookmark_processing_runs` sums tokens, cost and duration per run (`database/schema.ts:372`). The extraction provider and follow outcome sit at `metadata.extraction` on the stored content. Digests store `model_id` on `feed_digests` (`services/digest.service.ts:420`).

Nothing records provider options, a prompt version or a code revision. Runs and events cascade-delete with their bookmark (`supabase/migrations/20260621000001_create_bookmark_processing_timeline.sql:5`).

## The eval

`apps/api/scripts/summary-eval.ts` is one manual command. Its header lists the `prepare`, `run`, `judge`, `calibrate` and `report` subcommands (`:8`). It drives production `process()` on fresh rows in the disposable test database on port 5433 (`:161`). It reads only `OPENROUTER_API_KEY` from `--secrets`.

- **Manifest.** `apps/api/scripts/summary-eval/fixtures.json` registers 12 public URLs: five link-posts, a plain post, a quote post, four readable articles and a standalone paywall.
- **Cache.** `prepare` stores live extraction per revision under `out/sources/<sha>/` (`:176`). Each `run` child reads that cache at the `scrape` boundary.
- **Isolation.** Each model runs in its own child process with `BOOKMARK_MODEL_LARGE` set and no production variables (`:229`). The child asserts that the recorded model ID matches (`:253`).
- **Judge.** `x-ai/grok-4.7` (`:43`) grades coverage 3, accuracy 2, specificity 2, economy 1.5 and library metadata 1.5 (`:45`). The judge prompt is at `:369`.
- **Calibration.** `calibrate` picks five blinded records from distinct fixtures and writes a grading page with a copy button (`:439`). The page for the matrix exists at `out/calibration/decision/calibration.html`, with its key in `key.json` beside it.
- **Report.** `report` prints gates G-1 to G-5, cuts, cost and latency, and a D-6 eligibility line (`:547`).

All output lives in `apps/api/scripts/summary-eval/out/`, which is gitignored (`apps/api/scripts/summary-eval/.gitignore:1`). The repo is public, and the cache holds third-party article text. Commit only URLs and synthetic fixtures.

**Baseline.** Luna at `161a8fd`, before this branch. 33 judged records had a mean of 6.29 out of 10. Readable link-posts (G-1) averaged 4.64, with the weakest fixture at 3.3. The mean spread was 0.6. Ten fields were cut with `…`, and 15 factual flags were never verified. Summarise cost was $0.00022 per save.

**Unjudged matrix.** The `decision` label holds 108 records: Luna, Haiku and Sonnet, 12 fixtures, three runs each, at `47dce7e`. That revision predates the D-20 prompt, so its paywall outcomes no longer match shipped behavior. To judge it, keep the blind first:

1. Have the owner grade the five records on the calibration page before anyone reads a score.
2. Run `bun apps/api/scripts/summary-eval.ts judge --secrets <env file> --label decision --reference 47dce7ec64e23290f86f29b34224d79a6a51ae01`.
3. Run `bun apps/api/scripts/summary-eval.ts report --label decision --baseline baseline`.

## Engagement signals that exist today

| Signal | State | Where |
|---|---|---|
| Open a bookmark | Partial. Only an explicit mark-read sets `read_at` and the first `feed_impressions.opened_at`. Opening the detail screen is not logged. | `apps/api/src/routes/bookmarks.ts:1016`, `repositories/feed.repository.ts:737` |
| Read state | Present as current state. Unread clears it. | `database/schema.ts:56` (`read_at`) |
| Reading progress | Partial. Latest `percent` and `scroll_offset` only, no history. | `database/schema.ts:248`, `apps/api/src/routes/reading.ts:155` |
| Time on page | Absent | No column or event |
| Highlights and notes | Present | `database/schema.ts:263`, `apps/api/src/routes/reading.ts:260` |
| Quick access | Not a signal. `quick_access` is a search text column. | `supabase/migrations/20251007000001_add_bookmark_quick_access_search.sql:3` |
| Title edit | Partial. `titleOrigin: owner` marks an edit and the old title is lost. | `repositories/bookmark.repository.ts:443` |
| Tag and summary edits | Partial. `PATCH /bookmarks/:id` overwrites with no marker. | `apps/api/src/routes/bookmarks.ts:953` |
| Retry and Regenerate | Partial. Each creates a new run. The phase scope is in the request only, not on the run. | `apps/api/src/routes/bookmarks.ts:812`, `database/schema.ts:372` |
| Delete | Absent as a signal. Hard delete cascades the runs and events. | `services/bookmark.service.ts:727` |
| Archive | Partial. `is_archived` boolean with no timestamp. | `apps/api/src/routes/bookmarks.ts:953` |
| Likes and comments | Present, mostly social | `database/schema.ts:104`, `:211` |
| Digest inclusion | Present. `source_bookmark_ids` with `model_id`. | `database/schema.ts:329` |
| Digest opens, likes and shares | Present. Opens use `feed_impressions`. Clicks from a digest to a source are not logged. | `apps/api/src/routes/digests.ts:70`, `:79`, `:137` |
| Feed exposure | Present for feed items. `served_count`, `last_served_at` and `opened_at`. | `database/schema.ts:282` |
| Feed feedback | Present. `not_interested`, `fewer_domain` and `mute_topic`. | `database/schema.ts:301`, `apps/api/src/routes/feed.ts:298` |
| Today's 5 exposure | Present. Daily `bookmark_ids` and `reasons`. | `database/schema.ts:4` |
| Filing moves | Present. A move sets `filing_source = 'user'`. | `apps/api/src/routes/bookmarks.ts:1162`, `repositories/bookmark.repository.ts:250` |
| Collection suggestions | Present. `pending`, `accepted` or `dismissed`. | `database/schema.ts:34`, `apps/api/src/routes/collections.ts:160` |
| Sharing and reshares | Present. `is_public`, `share_slug` and `saved_from_bookmark_id`. | `services/bookmark.service.ts:800`, `database/schema.ts:56` |

There is no analytics event pipeline and no feature-flag system. A search for PostHog, Amplitude, Mixpanel, Segment, LaunchDarkly, GrowthBook, Statsig, Unleash, Sentry and flag helpers found none. The web app loads a Google Analytics page-view tag in production with no custom events (`apps/web/app/layout.tsx:107`). Mobile has no analytics. The closest precedent for runtime config is `feed_ranking_config`, per-environment ranking weights read at request time (`database/schema.ts:365`).

## What attribution needs

- **Setup identity.** Store a setup per run and per current summary: model, provider options, prompt version and pipeline version.
- **Assignment.** The model is a process-wide constant read at import. A per-save or per-user setup must become a parameter of `process()` and of the digest call.
- **Exposure.** Log when a summary was shown, on which surface, under which setup. Only feed items and Today's 5 record exposure now.
- **Durable outcomes.** Deletes and edits erase their evidence. Keep a tombstone or event before the delete cascades, and record edits as events.
- **Comparison windows.** §8.8 of the spec compares days 1, 3 and 7 against the prior seven days by hand. No tool computes it.

## Constraints and lessons

- **D-6 was deferred.** The rule picks the cheapest candidate within 0.5 points of the top mean, with zero factual errors and cost within $0.03 (spec §8.9). It depended on owner calibration (D-18), which did not run. The owner chose Haiku instead (D-19).
- **Judge trust.** Grok grades, but a Claude builder wrote the rubric and verifies factual flags, and two of three candidates were Claude models. Owner grades are the only check on that overlap.
- **Product rule.** Ranking optimises for usefulness, not engagement (`docs/functional-spec/01-product-model.md:59`, `docs/functional-spec/05-feed.md:67`). Feed tests reject dwell and engagement signal names (`apps/api/src/tests/feed.test.ts:524`).
- **Credit refusals.** OpenRouter refused parallel requests when in-flight reservations exceeded the balance. Seven Sonnet records failed in the first pass and reran (`out/failed-attempts/decision/`). Judge replies are capped at 8,000 tokens for the same reason (`apps/api/scripts/summary-eval.ts:417`). The balance ran out during this eval, and the owner added credits on 2026-11-27.
- **One process per config.** Model IDs are read at import, so the eval spawns one child per model.
- **Cost and latency.** These are summarise turns in the `decision` run, 36 records per model. Luna cost $0.00035 per save with a 4.0 s mean and 6.4 s p95. Haiku cost $0.00092, 5.1 s and 8.8 s. Sonnet cost $0.0179 with a $0.042 maximum, 7.1 s and 12.0 s. Haiku cut 9 fields with `…`, Luna 6 and Sonnet 4.
- **D-20 on Haiku.** Both paywall fixtures resolve as paywalls in three of three runs. Free ledes lose their summaries by design.
- **Privacy.** Sources are third-party text sent to OpenRouter. Engagement data is private to the owner. Highlights stay private even on public bookmarks (`database/schema.ts:257`).
- **Display limits.** Mobile detail shows the title, brief and key points. It shows the overview and sections only when the brief is empty (`apps/mobile/app/bookmark/[id].tsx:657`). A setup that improves the overview is mostly invisible on mobile.

## Open questions

- Which outcomes count as a better summary, and with what weight: edits, Regenerate, deletes, reads, highlights or explicit ratings?
- Is the unit of assignment the user or the save?
- Is a time-based signal acceptable for setup choice, given the ranking rule?
- Does a judged offline eval remain the gate before a setup gets traffic, and who calibrates it?
- Is there enough save volume for engagement to separate two setups within a window?
- Do digests follow the summary setup, or get their own?
- How are prompt versions named: a hash of the built prompt or a stored identifier?
