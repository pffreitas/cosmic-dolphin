# Save summary quality

| | |
|---|---|
| Status | Approved |
| Date | 2026-11-26 |
| Owner | Paulo |
| Council | PM and Architect approved the integrated candidate · Designer N/A |
| Generated with | `/home/paulo/.codex/skills/spec` · sha256:4b7583f6a81b9aef4c6e3fbc2dd1eca7411ada5545d48f0ef1fb90689868bbd1 |
| Code snapshot | `4c8d362` · live `main` at `671e278` includes worker queue fix #264 |
| Links | [Approval page](2026-11-26-save-summary-quality/approval.html) · [Backend plan](../../plans/2026-11-15-save-pipeline-backend.md) |

## 1. Summary

Owners who save X posts miss the substance of linked articles. Restore X extraction and read one eligible link. Summarise the readable article under its own title, attribute material framing or dissent to the poster, and keep a post-only summary that identifies the unread host when the follow fails. Select the model for summaries and digests with a production-code eval.

**Decisions to review.** One eligible link (D-7), owner title precedence (D-10), cost and quality rules for model selection (D-6, D-17), and five blind owner grades (D-18).

## 2. Problem and goals

A local replay of Will Larson’s post saved `Tweet by Will Larson` without the article or chart and scored **3.5/10**. Luna scored **7.25/10** with the structured article and revised prompt. Haiku scored **8.5**, Sonnet **9.0**. These exploratory scores used one fixture, Lead grading, prototype code and options that differed from production. The production row was unavailable. See §3 for the extraction evidence.

| ID | Metric | Target | Proof |
|---|---|---|---|
| G-1 | Readable link-post rubric score | Mean ≥7.5/10, each fixture ≥6.0 | FR-9 |
| G-2 | Four readable standalone articles | Mean ≥baseline +0.5, no fixture down >1.0 | FR-9 |
| G-3 | Title, brief or key point cut with `…` | Zero in eval, ≤1% of new saves in days 1–7 | FR-9, §8.8 |
| G-4 | Unsupported factual claims | Zero, builder verifies judge flags | FR-9 |
| G-5 | Mean summarise cost per save | ≤$0.03 in eval and days 1–7 | FR-9, §8.8 |
| G-6 | p95 fetch plus summarise duration | ≤prior seven-day baseline +15 s | §8.8 |

**Primary outcome.** In the decision eval and after deployment, save [Will Larson’s post](https://x.com/lethain/status/2124590238031094043). Expect the title “Shipping 100+ PRs to production in a week,” a brief pairing the bottleneck-by-bottleneck method with 115 PRs in a calendar week or 170 in a rolling seven-day span, and a full summary ordering the bottlenecks. Look for the fleet harness’s 153 of 170, verification replacing slow approvals, the `/my-open-work` triage skill and the limits of PR count as a value measure. Read shows post then article. Check the chart in extracted images and the thumbnail, confirm zero field cuts, and verify linked source and model events. A post-only recap or a recap of an unread article fails.

**Non-goals.** D-8, D-11 and D-13 cover deferred crawling, old saves and excluded pipeline work.

## 3. Current state

Paths are under `packages/shared/src/services/` unless prefixed.

- `twitter.service.ts:149` calls FxTwitter `/2/{id}`, which returned 404 for the example. oEmbed stores a short post. `/2/thread/{id}` returned expanded text, facets, photos and a thread with the focal post.
- `chunking.service.ts:49` collapses whitespace and drops alt text from the input to summary, tags, search and embeddings.
- `bookmark.processor.service.ts:441,851` clears summaries for unusable sources and fails the save. Invalid summaries get one brief-only retry. X images skip model selection.
- `bookmark.service.ts:236,428` publishes and reuses the stored row. Title CAS checks the expected title (`packages/shared/src/repositories/bookmark.repository.ts:767`).
- `bookmark.model-ids.ts:1` reads overrides at import. Only Luna receives low reasoning effort through `summaryProviderOptions`. The digest uses the large slot without summary-specific options.

**Constraints.** Keep one content row, the client contracts and existing processing phases. Commit only URLs and synthetic fixtures to the public repo.

## 4. Users and scenarios

- Owners save an X post promoting or disputing an article (FR-1, FR-2, FR-4, FR-5).
- A linked page is blocked, slow or a paywall teaser (FR-3, FR-8, FR-10).
- A short post or quote includes a photo (FR-1, FR-5, FR-11).
- A structured or multilingual article needs a better brief (FR-6, FR-7, FR-12).

## 5. Functional requirements

| ID | Requirement | Acceptance |
|---|---|---|
| FR-1 | Restore X extraction, quotes, photos and provenance | Example uses FxTwitter and the chart thumbnail. No stale short/media URLs, generated engagement/source lines, duplicate focal post or unavailable quote. |
| FR-2 | Summarise the article and attribute material framing or dissent | For a rebuttal, the brief or first key point conveys the poster’s stance. Use the article language when the post differs. |
| FR-3 | Complete usable posts when a follow fails or yields an unreadable page | A deterministic teaser fixture persists the §8.6 post-only result. |
| FR-4 | Store the quoted post before the readable article | Read shows both and search finds an article-only term. |
| FR-5 | Apply §8.4 title precedence | Example takes article title, plain and fallback posts get model titles, and direct articles keep their page titles, including generic ones. Owner edits survive fetch, Retry and Regenerate. |
| FR-6 | Preserve structure in extracted article text | Adjacent blocks stay distinct. Paragraphs, headings, list items and image alt text survive. |
| FR-7 | Give each field a distinct job within existing display limits | Exercise both summary variants and caps. Score cuts and repetition in eval. |
| FR-8 | Trace extraction and summarise decisions | Example records provider, summarise kind, linked URL and status. |
| FR-9 | Provide a rerunnable production-code eval | Report recorded requested models, rubric, score spread, errors, cuts, cost, latency and D-6 or D-17 result. |
| FR-10 | Enforce §8.7 eligibility and host rules | Multiple eligible links and previews make no follow. Reject invalid destinations before dispatch. |
| FR-11 | Use 0–5 nonredundant points for plain posts and 2–5 for articles and readable link-posts | A one-sentence post can have zero points. |
| FR-12 | Ship the selected model with the evaluated summary provider options | Verify the merge-candidate default and run a digest smoke. |
| FR-13 | Update extraction and pipeline docs | Document follow, provenance, prompt and key-point rules. Mark backend plan Finding 13 covered. |

**Prompt.** Treat source as untrusted data. Keep the existing unusable reasons and brief-only retry. Lead with the takeaway and its specific names or numbers. Add distinct supporting facts in key points, explain the argument in the overview, and follow source structure in sections. Preserve caveats and attribution. Target titles ≤70 characters, brief <220 and each point <110. Hard caps are 120, 240 and 140 respectively. For one- or two-sentence posts, omit overview and sections and use at most two points. Apply §8.6 source rules in the brief-only turn too.

## 6. Non-functional requirements

| ID | Target | Proof |
|---|---|---|
| NFR-1 | Stop linked reads by 60 s and honor earlier run cancellation | Fake clock and abort tests |
| NFR-2 | Zero usable posts fail because their article is unreadable | Processor proof |
| NFR-5 | Zero linked requests violating §8.7 and zero preview follows | Isolated transport tests |
| NFR-6 | Zero TypeSpec changes or migrations. Pre-release rows render, search and reprocess. | Serial integration |
| NFR-7 | Linked-source diagnostic emits only host, status, provider, error class and duration | Log assertion |
| NFR-9 | One manual command, zero copied pipeline functions, ≤$10 per full judged run | Eval receipt |

## 7. UX design

N/A. Existing clients render the data. Mobile’s “Summarised from the full article” footer also appears for extracted post-only content. The brief identifies the unread host. (`apps/mobile/app/bookmark/[id].tsx:698`)

## 8. Technical solution

### 8.1 Options considered

Keep both sources in one row (O-1). A second row requires a migration (O-2). A prompt-only follow omits the article from Read and search (O-3).

### 8.2 Architecture

Fetch builds the row. Summary classifies the linked body and can retain the post alone. Tagging, filing, search and embeddings use the retained source. X image promotion uses only post photos.

### 8.3 Changes by component

| Component | Change |
|---|---|
| X extraction | Use `/2/thread/{id}`, expanded text and facets. Include the focal post, remaining thread and available quote. Drop generated engagement/source lines and media placeholders. Keep fallback order and record provider on every path. |
| Article reader | Inject existing direct HTML extraction into the X reader and reuse response and usability checks. Keep the standalone fallback chain. |
| Text preparation | Extend `stripHtml` for block breaks, headings, list and quote markers, header with h1 and image alt text. Preserve embedding chunk bounds for long paragraphs among short blocks. |
| Summary processor | Add `link_post`, title on both schemas, fallback and provenance. Remove three unused prompt variants. |
| Eval | One manual entry point under `apps/api/scripts/` (§8.5). |

### 8.4 Contracts and data

**Stored content.** X rows keep `metadata.extraction.status` at `complete`. `provider` is `fxtwitter`, `oembed`, `lightpanda` or `opengraph`. Only an eligible FxTwitter follow adds `linked` with `url: string`, `status: "complete" | "failed" | "unreadable"`, optional page `title: string`, and `error` for a failure (extraction code, `timeout` or `rejected_host`).

For a row with `linked`, store each escaped post in a top-level `blockquote` with name, handle, date, a quoting label for a quote, then paragraphs. A complete follow appends one top-level `article` containing extracted HTML. Other X rows stay plain text. Word count and reading time cover the retained body. X Open Graph uses post metadata and the first photo as image.

**Summary inputs.** `buildSummarisePrompt` receives escaped linked URL, optional readable article title and `used | failed | unreadable` status. A complete follow sends structured post and article as `link_post`. A failed or unreadable follow sends the post as `tweet` with linked host and status. Both use the post source title. Other X rows send plain post text. Pasted text, articles and YouTube keep their source kinds. Each turn records `metadata.kind`, existing model ID and outcome, and `linkedUrl` and `linkedStatus` when present.

**Titles.** Add internal `titleOrigin: "pipeline" | "owner"`. A directly supplied nonblank public-capture title is owner input. Reshare-inherited titles are provisional. Store owner origin atomically on creation or title PATCH, including same-value edits. Every automatic public-bookmark title write, including standalone article fetch and X final-summary writes, requires pipeline origin and CAS against the observed provisional title in the same SQL update. Update quick access together, merge metadata atomically while preserving origin, and strip the field from API metadata.

Defer X titles until the final summary path is known and update the in-memory title before filing and indexing. Take the readable linked page title when available. Use the model title otherwise, including plain and fallback posts. Ignore empty model titles. Preserve unknown-origin legacy titles on reprocess and existing private-link title behavior.

### 8.5 Eval

Commit the harness first on the actual PR base and measure that pre-change pipeline with its recorded default. Drive production `process()` in an isolated disposable database with identical owner context and fresh rows per run. Cache production extraction at the injected `scrape` boundary per revision. Use the existing embedding seam for zero vectors. Isolate configs in separate processes, set `BOOKMARK_MODEL_LARGE` before imports, and assert recorded summarise model IDs. Gitignore cached sources and stored records. Keep reference sources identical across configs. Report recorded cost and latency, with separate live extraction timing.

Run the baseline and D-15 candidates three times per fixture. Register 12 URLs before scoring. Include five link-posts (example, own article, disagreement, paywalled follow, incidental link), two plain/quote posts, four readable articles (structured, chart alt text, news, non-English), and one standalone paywall. Cache a successfully fetched teaser for the linked paywall. Test an ordinary failed follow separately. Report both paywall outcomes. Expect a standalone paywall reaching summarise to fail with code `paywall` and empty summaries.

Judge 11 prose fixtures, including the linked paywall’s post-only result, with `x-ai/grok-4.7`. Use a ten-point rubric of coverage 3, accuracy 2, specificity 2, economy 1.5 and library metadata 1.5. Score G-1 on readable link-posts. Average the three scores per fixture, then weight fixtures equally. Report spread as the mean per-fixture max minus min. Record missing runs and failures. Invalid fixture setup or model ID mismatch invalidates the decision run. Retain expected refusals as outcomes. Rank only candidates with all required scores. Measure caps and cuts directly. The builder verifies factual flags against sources. Re-judge from stored outputs.

Before viewing scores, select five records from distinct fixtures covering all candidates, readable link-posts and standalone articles. Hide model and judge output. The owner uses the same rubric and sources. Require each judge grade within one point and every owner-found error flagged. On a miss, revise the rubric once and re-judge the full matrix with the same owner grades.

### 8.6 Error handling and edge cases

| Condition | Behavior |
|---|---|
| Zero or several eligible links, preview, or X fallback provider | No follow or unread note. |
| Rejected, failed or timed-out follow | Store quote-only content with `linked.status: failed`. Complete a post-only brief naming the unread host. |
| Successful fetch yields paywall, consent or error page | `link_post` returns `unusable` for the linked page. Before fallback, guard the same-ID row update on prior linked status `complete`. Atomically persist `unreadable`, post-only body and links, update public reading counts, clear stale article summary fields and search text, and delete old chunks. Keep linked title only as provenance. Invalidate prepared text and use the retained row downstream. Rerun as `tweet` with the failed-follow note. A brief-only scoped retry on this row must leave no article overview. |
| Bare-link post with unreadable article | Only an unusable post-only turn can fail the save with `Unusable source`. |
| Abort during follow | Propagate run cancellation. Redelivery can fetch if no row was written. |
| Retry or Regenerate | Reuse the complete row, including persisted unreadable outcomes. Rebuild lexical search on scoped summarise retry. The existing embed phase rebuilds cleared chunks when in scope. Preserve tagging and filing phase scope. |

### 8.7 Security and privacy

Normalize and deduplicate expanded links. Follow exactly one after excluding X, t.co, YouTube and PDF paths. A request-local `CosmicHttpClient` guard applies before every dispatch, redirect and retry. Reject non-HTTP(S), IP literals, localhost and its subdomains, and single-label hosts. Check the final URL before consuming it. Use direct HTTP and guarded redirects. Map a rejected hop to nonretryable `rejected_host`. Fall back to the post if the page needs rendering. Backend plan package 3 covers DNS and egress protections. Sanitize source inputs and keep provenance in existing owner-scoped processing events.

### 8.8 Observability

Compare days 1, 3 and 7 with the seven days before deploy. Split X and other saves. Pool G-5 across new saves and report its split for diagnosis. Sum all billed summarise turns per save, including failures and fallback, then average. Missing billable usage is unknown. For G-6 use the first run’s completed fetch plus summarise times. Read cuts, failed-save share, failed summarise events, provider and follow outcomes. For unexpected summarise failure share, divide matching failed runs by all runs for new saves in the same window and cohort. Log each follow once as `Linked source` with NFR-7 fields. Suppress inherited full-URL request and retry logs for follows.

| Trigger | Action |
|---|---|
| Failed save share up >2 percentage points or p95 up >30 s | Revert |
| Unexpected summarise failure share up >1 percentage point. Count failed runs whose last summarise phase failed for a reason other than `Unusable source`. | Revert model. Revert release if still up next day. |
| Mean G-5 cost >$0.045 on day 1 or 3, or >$0.03 on day 7 | Revert model |
| Last summarise turn `link_post` on a run failed as `Unusable source` | Open an issue on any occurrence. Revert if >1% of X saves. |
| Production primary outcome fails | Revert |

### 8.9 Rollout, migration and rollback

Choose the cheapest candidate within 0.5 points of the top comparable mean before cost and error filters, with zero factual errors and measured G-5 cost within ceiling. When the score difference is strictly below the larger of two candidates’ spreads, favor lower cost among eligible candidates. Break equal costs by higher mean. Apply D-17 if no candidate qualifies, calibration fails again or G-1–G-5 miss. Under D-17, choose the highest comparable mean within ceiling and break exact ties by lower cost. Leave selection pending without a comparable eligible score. Attach scores, costs, failed gates, calibration discrepancies and observed errors to the PR. Keep functional and safety gates in force.

Change only the `large` default after evaluation. Rerun the example and a digest smoke with `generateForUser` (`created` or `model_declined`). Rerun the decision eval if other evaluated code or options change. Keep the small model and deploy env unchanged.

Run contract generation, serial disposable backend suites and Linux API/worker image proofs before merging. Follow the [release runbook](../../runbooks/backend-and-testflight-release.md). Require PR Accessibility and owner go on the actual head. One squash PR to unprotected `main` deploys API and worker via `deploy-backend.yml`. Backend CI repeats release checks on push to main. No staging or migration. The owner runs production proof and reads. Revert the squash commit for full rollback or the large default for model rollback. Old code renders new rows and may send raw X HTML on reprocess.

### 8.10 Test strategy

| Level | Proof |
|---|---|
| Unit | X parsing and photos, pre-dispatch host checks, timeouts, previews, structure and prompt boundaries |
| Serial backend integration | Seeded teaser yields two ordered turns and post-only row, Read, search and chunks. Interrupt after classification and verify replay. Seeded standalone paywall fails with `paywall` and empty summaries. Concurrent, prior and same-value owner title edits survive for X and standalone articles. Verify readable rows, legacy and scoped retries. |
| Paid eval | §8.5 calibration, quality/cost results and model decision. Seeded functional proofs remain required regardless of model quality. |
| Merge candidate and production | Release checks, digest smoke and primary outcome |

## 9. Risks and dependencies

| Risk | Consequence | Mitigation and owner |
|---|---|---|
| FxTwitter changes or rate limits | Post-only fallback | Provider share (§11), owner |
| URL-syntax host check | DNS and remote transport risk | Direct guarded follow and package 3, builder |
| Classifier mistakes or model credit refusal | Incorrect source or unavailable summary | FR-3, D-17 disclosure and model rollback, builder and owner |
| Longer reads | Slower X saves | NFR-1, G-6 and rollback, owner |

## 10. Decisions

| ID | Choice and basis | Decider |
|---|---|---|
| D-1 | Spec and approval page only. Implementation, merge and deploy need separate authorization. | User |
| D-2 | Standard backend spec with existing reader and cards | Lead |
| D-3 | Article substance with attributed poster stance | Lead |
| D-4 | FxTwitter thread endpoint and expanded text | Architect |
| D-5 | A failed follow yields a usable post when there is one | Lead |
| D-6 | Predeclared cost and quality rule (§8.9). Digest shares `BOOKMARK_MODEL_IDS.large`. | User |
| D-7 | Follow exactly one eligible link | User |
| D-8 | Defer model-driven crawling | User |
| D-9 | Quoted post and readable article share one stored row | User |
| D-10 | Linked page title or model title for X under §8.4. Owner edits take precedence. | User |
| D-11 | No legacy refetch or bulk regeneration | User |
| D-12 | Ship with host guard before package 3 | User |
| D-13 | One backend PR. Exclude client UI, X Articles, YouTube follows, vision, tag/filing prompt rewrites, the rest of backend plan package 4 and a feature flag. | User |
| D-14 | Drop generated engagement and source lines | Lead |
| D-15 | `openai/gpt-6-luna`, `anthropic/claude-haiku-5.5`, `anthropic/claude-sonnet-5.5` based on trial quality, latency and cost | PM |
| D-16 | Apply v2 to stored text on legacy X regeneration. Preserve unknown-origin titles. | Lead |
| D-17 | Permit the highest-scoring cost-eligible fallback with disclosed misses (§8.9) | User |
| D-18 | Owner calibrates the judge with five blind grades (§8.5) | User |

## 11. Assumptions and readiness

- **A-1** FxTwitter remains available. Use existing fallbacks if it fails.
- **A-2** Validate OpenRouter credit before merge. The local key showed in-flight credit limits.
- **A-3** Budget up to $30 for three judged runs and re-judging. The owner authorizes additional spend.

**Readiness.** Ready for owner review. Architect rehearsed the teaser-to-post commit and redelivery, title races, pre-dispatch rejection, eval isolation and rollout. Implementation tests and paid eval remain release gates.

| Check | Owner and trigger | Action on miss |
|---|---|---|
| Eval model and quality gate | Builder, decision run before merge | D-17 |
| ≥90% completed X saves use FxTwitter | Owner, day 7 | Open an issue with provider and follow failures |
| ≤5% follows end transiently blocked, timed out or provider-failed | Owner, day 7 | Open a re-follow follow-up |

## 12. Glossary

**Link-post** — X post containing exactly one eligible external link. **Save** — the persisted bookmark and its summary, reader content, metadata and derived indexes.
