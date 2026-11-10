# Save + Today’s 5

| | |
|---|---|
| Status | Approved by Paulo Freitas on 2026-11-10 |
| Date | 2026-11-09; revised 2026-11-10 |
| Owner | Paulo Freitas |
| Council | PM ✅ · Architect ✅ · Designer ✅; final read complete 2026-11-10 |
| Generated with | /Users/paulo.freitas/.agents/skills/spec · sha256:4b7583f6a81b9aef4c6e3fbc2dd1eca7411ada5545d48f0ef1fb90689868bbd1 |
| Revision | cosmic-dolphin @ b7045a4c56f896d085e2e1aef79b12ea1cfa6407 |
| Links | [Prototype](./2026-11-09-save-and-todays-5/prototype.html) · [Backlog](./BACKLOG.md) |

References use the revision above. Unqualified paths: mobile → `apps/mobile`; API routes/middleware → `apps/api/src`; shared services → `packages/shared/src/services`. Approval provenance and current hashes are preserved in [tasks.md](./2026-11-09-save-and-todays-5/tasks.md).

## 1. Summary

People save links but rarely read them. This release makes sharing safe enough to close the tab and gives the library owner daily picks with server-written reasons. Done, Later and Next pick make a reading session. The bookmark page offers a brief, extracted text, the original and recovery when extraction fails.

It extends the Expo app and backend; wider AI Library and cited answers remain in the ordered backlog. Success means more saves read within seven days, daily pick use and reliable queued capture (§2).

**Decisions to review:** daily persisted picks (D-14); native share capture and restricted key (D-5, D-21); mobile plum direction (D-7, D-9); scope and single release package (D-13).

## 2. Problem and goals

**Statement.** People leave links open "for later" and never read them. The app gives no finite answer to "what should I read now"; sharing opens it and waits for a tap.

**Evidence.** §3 "iOS share"; reading measures success (`docs/functional-spec/01-product-model.md:75`).

**Why now.** The approved prototype (D-1, D-2) replaces the October direction while the app is in TestFlight.

| ID | Outcome | Metric (§8.8) | Baseline | Target |
|---|---|---|---|---|
| G-1 | Saves get read | `save_to_done_7d`: % of a week's saves done within 7 days | 8 weeks pre-release | +50% relative, over 4 weeks after |
| G-2 | Picks get used | `picks_done_per_active_day` | 0 | ≥ 1.5 |
| G-3 | Sharing replaces the tab | `ios_share_save_share`: % of iOS saves via the extension | 0 | ≥ 40% |
| G-4 | Saving holds (guardrail) | `saves_per_active_user_week` | 8 weeks pre-release | ≥ −10% |
| G-5 | Picks aren't rejected (guardrail) | `pick_not_for_me_rate`: % of picks given Not for me | 0 | ≤ 20% |
| G-6 | No queued save lost (guardrail) | `queued_save_lost` | — | 0; any loss blocks wider rollout |

G-1 flat after 4 weeks → revisit picks before backlog 3–5 (D-12).

**Primary outcome test.** On a device build, a user with ≥ 5 eligible saves shares from Safari. The extension closes (FR-1), and the save appears pending above the picks (FR-6). The user swipes a pick done (FR-10), reads another (FR-20), marks it done, taps Next pick (FR-21), then relaunches on a second device.
- *Evidence:* one bookmark with `capture_source = ios_share_extension`; the same picks and reasons on both devices; both picks read on web.
- *Counterexample:* client-written reasons, device-only state, or an extension that opens the app.

**Non-goals.** BACKLOG.md items and cuts (D-13); notifications (D-6); digests as picks; an analytics SDK.

## 3. Current state

| Area | Fact to respect | Evidence |
|---|---|---|
| Save | Unique-index dedupe per user/URL (200 `alreadySaved`); no inline scrape; 100/day per `request.userId` | `apps/api/src/routes/bookmarks.ts:536-563,625-647`; `plugins/rate-limit.ts:60` |
| Auth | One JWT middleware; 1 h tokens; refresh-token reuse revokes the session | `apps/api/src/middleware/auth.ts:11-38`; supabase.com/docs/guides/auth/sessions |
| Ownership | Bookmark mutations return 404 for non-owners | `routes/bookmarks.ts:1061-1073` |
| iOS share | Committed `ShareExtension` writes `group.com.cosmicdolphin.app` and opens the app; committed native dirs make EAS skip prebuild | `ShareViewController.swift:122-133,480-497`; docs.expo.dev/workflow/continuous-native-generation |
| Mobile state | Session in expo-secure-store; captures in memory only | `lib/supabase.ts:23-78`; `IMPLEMENTATION.md:10` |
| Ranking | Server reasons; in-process `Map` sessions; `not_interested` hides one item | `feed-ranking.service.ts:506-510,626-680,822-823` |
| Content | Sanitised HTML is stored, never served, and reused on reprocess | `web-scraping.service.ts:263-316` |
| Failure | Worker-only fetch codes; Summarise judges paywalls `unusable` (free text), then briefs from Open Graph description | `content-extraction.ts:15-31`; `bookmark.processor.prompt.ts:145`; `bookmark.processor.service.ts:639-645` |

**Constraints.**
- Contract first; generated client committed; logic in `packages/shared`.
- Server-written reasons only; a user refile always wins; notes never on shared or followed saves (D-3).
- Additive migrations, applied before the API deploys (`deploy-backend.yml:84-110`).
- The extension never refreshes the Supabase session.
- No OTA updates.

## 4. Users and scenarios

One role, the library owner (`docs/functional-spec/01-product-model.md:11`); followed people are feed actors only. iOS and Android phones, English.

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The iOS share extension shall save on open with the share key (D-21), show the result and close without opening the app. | Must |
| FR-2 | On any request failure the extension shall queue the URL on the phone and say so; the app sends it on next launch or foreground. | Must |
| FR-3 | Android sharing shall open the app, save without a tap, and return to the previous app. | Must |
| FR-4 | The save sheet shall offer a link field and, when the clipboard holds a URL, the copied-link row (D-10). | Must |
| FR-5 | The save sheet shall write the bookmark on Save, then offer an optional note and Read when: Tonight, This weekend, No rush (FR-11). | Must |
| FR-6 | A new save shall top Home showing pipeline phases, then its filing path; when completed after the day's set exists, it appears in the more feed below the picks. | Must |
| FR-7 | The system shall fix one set per user per pick day (06:00–06:00 local): up to 5 eligible own saves from the feed ranker, identical across devices and refreshes. | Must |
| FR-8 | Each pick shall show the server's reason verbatim; the client never composes one. | Must |
| FR-9 | Home shall show done of N and minutes left; N excludes archived, deleted, Not for me’d picks and unexpired `later_until` snoozes. | Must |
| FR-10 | On own saves, swipe right or Done shall set `read_at` at once with an 8 s Undo. A done pick stays in the set. | Must |
| FR-11 | On own saves, swipe left shall snooze to Tonight; Later offers four times and Not for me, sent at once with an 8 s Undo. Device-local: **Tonight** 20:00 (tomorrow if now ≥ 19:00); **Tomorrow** 07:00; **This weekend** next future Sat or Sun 09:00; **Next week** next Monday 07:00. | Must |
| FR-12 | Not for me shall hide the card with 8 s Undo, archive own saves immediately, and send `not_interested` on toast close, navigation away or background. | Must |
| FR-13 | Card actions (⋯, long press) shall be: own saves Open, Mark done/not done, Later…, Move…, Not for me. Followed and reshares: Open, Save to Library, Not for me. Digests: Open only (D-23). | Must |
| FR-14 | For you shall show the picks, Continue (FR-30), up to 10 more unsnoozed For-you items, then the caught-up end with the unread count (D-11). | Must |
| FR-15 | Pull to refresh shall re-read picks and feed without changing the set. | Must |
| FR-16 | Followed items shall show actor and server reason, never a note (D-3). | Must |
| FR-17 | The tab bar shall be Home · Save · Library, with profile behind the Home avatar (D-16). | Must |
| FR-18 | The bookmark breadcrumb shall open Move; a confirmed move stops AI refiling. | Must |
| FR-19 | The user shall add, edit or clear a private note (≤ 500 characters) at save and on the bookmark page. | Must |
| FR-20 | The bookmark page shall offer Brief (brief, key points, provenance), Read (extracted text) and Original (in-app browser). | Must |
| FR-21 | Mark done on a pick's page shall show the done count, Undo and Next pick (next undone visible pick). | Must |
| FR-22 | A save with a `processingFailureCode` (§8.4) shall show its reason and Open original, plus Paste the text (replaced by Try again for `provider`) and the bar Later · Mark done, with an empty brief never filled from metadata. | Must |
| FR-23 | Paste the text shall accept 200–100,000 characters as content and rebuild the brief, marked as from pasted text. | Must |
| FR-24 | Merged into FR-22. | — |
| FR-25 | A user with no saves shall see first run: the copied-link row and how to share. | Must |
| FR-26 | Every save shall record `capture_platform`, `capture_source` and, if queued, `capture_queued_at`. | Must |
| FR-27 | Unsent saves shall persist on the phone until the server accepts them, one bookmark per URL. | Must |
| FR-28 | Mobile shall use the plum accent tokens in light and dark; web is unchanged (D-9). | Must |
| FR-29 | Home shall offer For you · Following · Unread; Following and Unread keep their paged lists, with no picks, Continue or end (D-20). | Must |
| FR-30 | For you shall show a Continue reading row after the picks (D-19). | Must |

**Acceptance criteria.**
- **FR-1** A valid-key Safari share creates exactly one bookmark; screen-reader behavior follows §7 Accessibility.
- **FR-2** Exactly one bookmark after next app open for §8.6 "Share token missing or revoked", "Share offline" and "Rate limited (429)".
- **FR-3** Offline/signed-out arrival follows §8.6 "Android share signed out".
- **FR-4** Opening the sheet shows no paste prompt and no title before the tap.
- **FR-5** No rush sets no snooze.
- **FR-6** Failure replaces the card in place (FR-22).
- **FR-7** 3 eligible across ≥ 2 domains give 3 picks (≤ 2 per domain). At 05:59 local and with 0 eligible, apply §8.6 "0 eligible, or before 06:00".
- **FR-8** A For-you item without `rankingReason` shows no reason line.
- **FR-9** 5 picks, one done, one snoozed Tonight at 10:00: "1 of 4", then "1 of 5" at the first Home load or focus after 20:00 (`revealsAt`, D-14).
- **FR-10** Undo within 8 s clears `read_at` and restores the slot; network failure follows §8.6 "Action while offline".
- **FR-11** This weekend on Saturday 10:00 is Sunday 09:00; on Sunday 10:00 it is next Saturday 09:00. Next week on a Monday is the following Monday.
- **FR-12** Undo and process kill follow §8.6 "Not for me Undo"; followed saves are never archived.
- **FR-13** Followed saves and digests have no swipe, Done or Later buttons.
- **FR-14** Fewer than 10 items end early.
- **FR-15** A save eligible after the set appears below it.
- **FR-16** Public models strip `userNote` (§8.4 "Bookmark additions").
- **FR-18** A moved save survives reprocessing.
- **FR-20** No extracted content follows §8.6 "Content 404 or offline".
- **FR-21** After the last undone pick, "All {N} done" and Back replace Next pick; outside the set, Done, Undo, Back.
- **FR-22** Even with an Open Graph description, unusable content leaves `cosmicBriefSummary` empty; no-code failures follow §7 Copy.
- **FR-23** 199 characters keeps submit disabled. Success returns the card to pending.
- **FR-25** Existing saves with no set today show no-picks, not first run (§7).
- **FR-26** A queued iOS share records `ios`, `ios_share_extension` and `capture_queued_at`.
- **FR-27** App kill preserves an unsent save; relaunch accepts `alreadySaved` as success.
- **FR-28** Accent pairs meet NFR-7; web `tokens.css` is unchanged.
- **FR-29** Unread lists own unread saves newest first.
- **FR-30** No save in progress hides it.

## 6. Non-functional requirements

| ID | Category | Requirement | Target | Verified by |
|---|---|---|---|---|
| NFR-1 | Performance | Share panel status | ≤ 2 s in ≥ 19/20 shares on Wi-Fi and on LTE; queue at 8 s | Device checklist (`os_log`) |
| NFR-2 | Performance | `GET /picks/today` | p95 ≤ 800 ms compute (500 candidates), ≤ 200 ms re-read | API test; DOC-1 |
| NFR-3 | Performance | `GET /bookmarks/{id}/content` | ≤ 500 KB, p95 ≤ 400 ms | API test, 20,000 words |
| NFR-4 | Reliability | Queued saves | 0 lost: on the server, or a failed row, within 24 h of an online foreground | Jest; airplane test; DOC-2 |
| NFR-5 | Integrity | One bookmark per user and URL | 0 duplicates, 2 concurrent creates | API test |
| NFR-6 | Responsiveness | Done, Later, Not for me | optimistic; Undo 8 s; revert on failure | RNTL |
| NFR-7 | Accessibility | Plum tokens | text ≥ 4.5:1, UI ≥ 3:1, both modes | Mobile contrast test |
| NFR-8 | Accessibility | Swipe actions | also a button and a screen-reader action | RNTL |
| NFR-9 | Security | Share key | `POST /bookmarks` only; 401 elsewhere; URL/capture fields only; response has no owner fields | API tests |
| NFR-10 | Compatibility | Previous build and web | nothing removed or renamed | `api-contract.test.ts`; smoke |

## 7. UX design

**Flows.** See FR-1…FR-30.
- Navigation: S-1 → S-11 (Next pick replaces it); ⋯ → S-3 → S-4 or S-12; + → S-5; avatar → S-15.
- Deep links: `cosmicdolphin:///`, `/save`, `/bookmark/{id}?mode=read|original`. Old `/reader/{id}` and profile-tab links redirect to S-11 and S-15.

**Screens**

| ID | Purpose | Entry point |
|---|---|---|
| S-1 | Home (FR-14, FR-29, FR-30); capture statuses above picks (§8.6) | Home tab |
| S-2 | For you with no picks: first run (no saves ever) or no picks today (none eligible) | S-1 |
| S-3 | FR-13 actions; Move is labeled “Move to topic…” | ⋯ or long press |
| S-4 | FR-11 options with computed day/time (“Sun, 9 am”) | Own-card/S-11 Later; S-3 |
| S-5 | “Paste copied link” (FR-4), FR-5; existing private-link option | Tab-bar +; S-2 |
| S-7 | iOS share panel: title and domain, status, Close (D-18) | iOS share sheet |
| S-11 | FR-18…FR-21 bookmark page; existing reading appearance; Later · Mark done bar | Card; deep link; Next pick |
| S-12 | Move to topic (existing refile list) | S-11 breadcrumb; S-3 |
| S-15 | Existing profile/settings; sign-out failure per §8.6 | Home avatar |
| S-16 | FR-22 failure on S-1 card and S-11 | Failure code set |
| S-18 | Undo toast (NFR-6) | Done, Later, Not for me, Move |
| S-20 | Android share arrival: S-7's states inside the app | Android share sheet |
| S-21 | Paste the text sheet | S-16 |
| S-22 | FR-19 note sheet | S-11 |
| S-23 | Unsent save row (§8.6 “Save request failed”) | Queue replay failure |

**State matrix**

| Screen | Default | Loading | Empty | Error | Offline | Success |
|---|---|---|---|---|---|---|
| S-1 For you | FR-14 | skeleton bar + 3 rows | S-2 | picks: Notice + Retry (§8.6); all: EmptyState + Retry | §8.6 “Action while offline” | §7 Copy |
| S-1 Following / Unread | existing | existing | existing | existing | as For you | N/A |
| S-2 | empty-state copy below; paste row | N/A: static | default | N/A | save queues | pending card |
| S-3/S-4/S-12 | options | S-12: skeleton | S-12: Inbox only | §8.6 “Action while offline” | same | Undo toast |
| S-5 | paste row if a URL is detected | Save busy | no URL: no row | invalid-link message | saved on phone | saved confirmation |
| S-7/S-20 | saved row | “Saving…” | N/A | §8.6 share conditions | queued | saved / already saved |
| S-11 | Brief | skeleton | no brief yet: phases | EmptyState + Try again | cached brief; Read: “Connect to load the full text.” | Done · n of N (FR-21) |
| S-16 | reason + actions | N/A | N/A | paste submit fails: Notice + Retry, text kept | optimistic, reverted with a toast | phases, then brief |
| S-15 | existing | revoking key: busy | N/A | §8.6 “Sign-out revocation failed” | same | signed-out entry |
| S-23 | URL + reason | N/A | N/A | §8.6 “Save request failed” | kept | pending |

Action failures follow §8.6 “Action while offline”; toast: “Change was not saved. Check your connection.”

**Copy** (no localization keys)

- **Failed save:** "Cosmic couldn't read this page because {reason}. Your link is safe." S-11 adds "Nothing is guessed from the headline."

  | Code | {reason} |
  |---|---|
  | `paywall` (model-judged) | "it needs a subscription" |
  | `auth` | "it asks you to sign in" |
  | `blocked` | "the site didn't let Cosmic read it" |
  | `empty` | "the page had no article text" |
  | `unsupported` | "Cosmic can't read this kind of page yet" |
  | `unavailable` | "the page wasn't available" |
  | `provider` | "Cosmic couldn't reach it just now" |

  Actions follow FR-22. A failed run with no code keeps the existing Retry Notice.
- **Share and save statuses:**
  - Saved: "Saved to Cosmic Dolphin" · "You can close the tab now. Cosmic reads it next."
  - Saved on phone: "Saved on this phone. Cosmic reads it when you open the app."
  - Already saved: "Already in your Library".
  - No URL: "Cosmic Dolphin can only save links".
  - Queue full: "Open Cosmic Dolphin to finish saving".
  - Save sheet: "Saved. Cosmic is reading it." · invalid link: "Enter a complete http or https link."
- **Home notices:** picks fail: "Today's picks couldn't load." · offline: "You're offline. Previously loaded saves are shown. Connect to save changes."
- **Today's 5:**
  - "{n} of {N} done · {m} min left". The minutes clause is dropped if a pick lacks a reading time.
  - "All {N} done" · "{m} minutes of reading cleared today".
- **Caught up:** "You're caught up" · "{unread} unread saves are in your Library." · **Open Library**.
- **First run:**
  - "Close the tab. Cosmic will bring it back."
  - "Save a link and your first pick appears here as soon as Cosmic has read it."
  - "Share from any app: tap Share, then Cosmic Dolphin."
- **No visible picks in a computed set:** "No picks to show" · "Today's picks are set for later or no longer in your Library. New saves appear below." Never "All 0 done".
- **No picks today:** "No picks right now" · "No saved links are ready for a pick right now. A new save can become a pick once Cosmic has read it."
- **Read when, after saving:** "Saved. Back on Home tonight at 8 pm." / "…on Saturday at 9 am." Never "joins Today's 5".
- **Read tab, no content:** "Full text isn't available for this save." + **Open original**.
- **Toasts:**
  - "Marked done"
  - "Back {computed time}"
  - "Archived. Cosmic won't pick it again."
  - "Moved to {topic}. Cosmic won't move it again."
- **Wording:**
  - "Done" replaces "Mark as read".
  - Done bar follows FR-21; reason lines follow FR-8 and its criterion.

**Accessibility** (beyond Signal defaults)

- **Own-save cards:** visible Later, Done and ⋯ (NFR-8); screen-reader actions *Mark done*, *Later*, *More actions*. Announce results.
- **Clipboard:** on iOS 15.1–15.x hide the copied-link row; use native field Paste without programmatic reading. iOS 16+ uses the native paste control.
- **Share panel:** S-7 and S-20 never auto-close while VoiceOver or TalkBack is on.
- **Undo toast:** Undo expires after 8 s everywhere. With a screen reader on, the status remains until the next toast or navigation, with Undo removed at expiry.
- **Reduce motion:** no card fly-out, bar fill animation, spinner rotation or countdown.
- **Dynamic Type:**
  - Content is uncapped; tab labels cap at 1.3×.
  - Rows/bars grow; the S-11 bar wraps.
  - Verify at iOS AX3 and Android 200%.

**Components**

New: *FeedCard* (reason/actions), *SwipeableCard*, *TodayProgress*, *Toast* (post-card Undo), *PendingPhases* (in CaptureStatus), *Button* trailing detail (Later times).

Accent: §8.4. Bookmark title: `title1`. Reuse `components/ui/Signal.tsx` and existing screens otherwise.

**Prototype.** [Standalone HTML](./2026-11-09-save-and-todays-5/prototype.html), built with cosmic-design: embedded app fonts/branding, fictional schema-shaped records, Signal tokens, approximate outline icons. Offline browser verification passed 29 initial and 20 closure assertions with no runtime errors; checked light/dark, 200% text and 320/390/768px layouts. Native sharing, assistive technology and backend persistence require §8.10 device/API proofs.

## 8. Technical solution

### 8.1 Options considered

| ID | Option | Pros | Cons | Verdict |
|---|---|---|---|---|
| O-1 | Extend the app, API and ranker in place | Reuses dedupe, reasons, pipeline | Edits the committed iOS project | **Chosen** |
| O-2 | A new mobile shell behind a flag | Old UI kept | No live audience to protect; screens built twice | Rejected |
| O-3 | Picks, done and later held on the device | No backend | Fails the primary-outcome counterexample | Rejected |

### 8.2 Architecture

| Component | Module | Responsibility |
|---|---|---|
| Share extension | `apps/mobile/ios/ShareExtension` (Swift, hand-maintained) | FR-1/FR-2 capture via `POST /bookmarks` and app-group queue |
| Share queue bridge | `apps/mobile/modules/share-queue` (local Expo module) | Reads and removes app-group entries |
| Save queue | `apps/mobile/lib/save-queue.ts` | Durable pending creates replace in-memory captures |
| Share key auth | `apps/api/src/middleware/share-key.ts` | Resolves `cdsk_` keys to `request.userId` on `POST /bookmarks` |
| Picks service | `packages/shared` `PicksService`, `PicksRepository` | Computes and stores the daily set with the ranker's scoring and `buildRankingReason` |
| Bookmark content | Existing shared `BookmarkService` and repository | Owner-authorized content read/paste; pure helper maps HTML → blocks; existing pgmq reprocess |

Rules:
- Server-owned picks/reasons; optimistic client reconciles (NFR-6).
- Queue replay is at-least-once, made safe by dedupe plus the §8.4 precedence.
- Picks are computed lazily, because the zone arrives with the request.

### 8.3 Changes by component

| Component or module | Change | New / modified |
|---|---|---|
| `apps/api` | Routes in §8.4; create and update accept the new fields; public serializers strip private fields | New + modified |
| Shared ranker | Own candidates exclude `later_until > now()`; picks scoring entry point | Modified |
| Shared processor | Failure codes per §8.4; unusable content blanks the brief, summary and key points, skips tag, file and embed, and fails the run | Modified |
| iOS | Extension rewritten; keychain group on both targets; `expo-share-intent` `disableIOS: true` | Modified |
| Android share | FR-3 flow (§8.4 Android) | Modified |
| Mobile Home | For you via `/bookmarks/feed?scope=for_you&limit=15`, `pending` shown apart, pick ids dropped, first 10 shown | Modified |
| Mobile routing | FR-17 navigation and §7 redirects | Modified |
| CI | `mobile-pr.yml`: `pull_request` on `deploy-mobile.yml` paths; mobile lint, `tsc --noEmit`, jest (D-17) | New |

### 8.4 Contracts and data

**Migration** (additive):

| Object | Columns | Notes |
|---|---|---|
| `bookmarks` | `later_until` timestamptz, `user_note` text (≤ 500), `capture_source` text, `capture_platform` text, `capture_queued_at` timestamptz, `processing_failure_code` text; all NULL | index `(user_id, later_until)`; capture-column rationale: §10 (`bookmark.service.ts:274-278`); clear failure code on run start |
| `daily_picks` | `user_id`, `local_date` date, `bookmark_ids` uuid[], `reasons` text[], `time_zone`, `computed_at` | PK `(user_id, local_date)`; RLS as `feed_digests`; cascades on user delete |
| `share_keys` | `id`, `user_id`, `device_id`, `key_hash` (SHA-256, unique), `created_at`, `last_used_at`, `revoked_at` | unique `(user_id, device_id)` while not revoked; RLS; cascades on account deletion |

**Bookmark additions.** Owner-only; strip from `GET /bookmarks/shared/{slug}`, `GET /users/{handle}/saves`, and followed and reshare feed items.

| Field | Values |
|---|---|
| `userNote`, `laterUntil` | string; utcDateTime |
| `captureSource` | `ios_share_extension \| android_share \| save_sheet \| clipboard` |
| `capturePlatform` | `ios \| android \| web \| unknown` |
| `processingFailureCode` | `auth \| blocked \| empty \| unsupported \| unavailable \| provider \| paywall` |

**Writes.**
- `CreateBookmarkRequest` adds optional `user_note`, `later_until?: utcDateTime | null`, `capture_source`, `capture_platform` (absent is stored as `unknown`) and `queued_at`. Null later_until means No rush. Private creates retain existing `is_private_link, title, description`; require nonblank title/description before Save (`apps/api/src/routes/bookmarks.ts:162`). Optional `user_note` is separate.
- Owner-only `PATCH /bookmarks/{id}` / `UpdateBookmarkRequest` adds `userNote?: string | null` and `laterUntil?: utcDateTime | null`. Omission preserves; null clears. Saved-confirmation note/timing use one update.
- On `alreadySaved`: `later_until` overwrites only when explicitly supplied (null clears it; omission preserves it); `user_note` is written only when the stored note is NULL; capture fields are kept; nothing is re-queued.
- Non-null `laterUntil` must be > now and ≤ now + 60 days, else 400 (FR-5, FR-11). Later Undo patches the prior timestamp or null; a prior timestamp that has elapsed clears to null.
- Read and bookmark PATCH are owner-only. Save to Library uses the existing `POST /bookmarks/{id}/reshare`.

**Picks.** `GET /picks/today?tz=<IANA>` → `{ localDate, refreshesAt, computedAt?, revealsAt?, items: { position 1..5, bookmark, reason }[] }`. `computedAt` exists only for a stored set.
- `localDate` is the date of (now in `tz` − 6 h). `refreshesAt` is the next 06:00. `revealsAt` is the earliest `later_until` of a hidden pick before `refreshesAt`; the client reloads on focus after it.
- `tz` must exist in `pg_timezone_names`. All zone math runs in Postgres. The client sends `Intl…resolvedOptions().timeZone`.
- **Compute.** No row and ≥ 1 eligible: insert `ON CONFLICT DO NOTHING`, then re-read. With 0 eligible nothing is stored.
- **Eligible.** Own, unread, unarchived, `completed`; not a private link without a brief; no `not_interested`; `later_until` NULL or ≤ now. Post-selection snoozes retain slots (D-14).
- **Selection.** At most 5 of the 500 newest, by ranker score, ≤ 2 per domain.
- **Visible.** Exists, unarchived, not rejected; `later_until` NULL or ≤ now. N = `items.length`; hidden slots follow D-14.

**Share key (D-21).**
- `POST /share-keys` `{ deviceId }` (JWT) → 201 `{ id, key }`, where `key` is `cdsk_` + 43 base64url characters, returned once. A new key for a device revokes that device's old one.
- `DELETE /share-keys/{id}` (owner JWT, idempotent) must succeed before sign-out clears the session and shared key. Failure keeps both and follows §8.6 Sign-out revocation failed.
- `Bearer cdsk_…` is accepted by `POST /bookmarks` only, under the same rate limit. Its body allowlist is `source_url, capture_source, capture_platform, queued_at`; any other supplied field gives 400. Share-key requests return `ShareSaveResponse { id, message, alreadySaved }`, never a Bookmark (including duplicate saves). JWT requests keep the current `CreateBookmarkResponse` unchanged; the TypeSpec route adds the response union, and contract tests cover both branches.
- Issue at sign-in and on foreground if the keychain item is missing.

**iOS shared storage.**
- Keychain group `$(AppIdentifierPrefix)com.cosmicdolphin.shared` on both targets.
- Item: service `com.cosmicdolphin.share`, account `share-key`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, value `{ key, keyId, deviceId, userId, apiBaseUrl }`.
- Queue: app group `group.com.cosmicdolphin.app`, file `pending-shares-v1.json`, ≤ 200 entries `{ id, url, userId?, queuedAt, notBefore? }`. For 429, `notBefore` is the Retry-After time; all other request failures omit it. Extension and bridge mutations hold an exclusive lock on a separate lock file; write a temporary file, flush and atomically replace the queue before acknowledging Saved on this phone. The bridge snapshots entries, durably imports them, then removes only imported ids under the lock.
- Extension sends `ios_share_extension` / `ios`.

**App save queue.**
- AsyncStorage `save-queue:v1`: `{ id, url, isPrivateLink?, title?, description?, note?, laterUntil?, captureSource, capturePlatform, userId?, queuedAt, attempts, notBefore? }`. Importing an iOS group entry preserves its id, queuedAt and notBefore, sets `ios_share_extension` / `ios`, and dedupes by id. Persist the app entry before removing its group entry; interruption may replay a duplicate but cannot lose a save. Serialize app queue mutations.
- Drain on launch, foreground, sign-in and pull to refresh after app-group import. Replay retains private title/description and flag; elapsed `laterUntil` becomes null, preserving note/source.
- An entry with a `userId` drains only for that user.

**Android.** The first URL from the `text/*` intent (`lib/shareIntent.ts:3`) is queued as `android_share`. Signed in: drain, show the saved state for 1.5 s, then `BackHandler.exitApp()`.

**Content.**
- `GET /bookmarks/{id}/content` (owner) → `{ blocks: { kind: heading | paragraph | quote | list_item, text }[], wordCount, source: extracted | pasted, updatedAt }`.
  - Returns 404 without complete content, or for a private link.
  - Blocks come from `h1–h4`, `p`, `blockquote` and `li` (≤ 2,000). Otherwise the text is split at blank lines, then into runs of ≤ 600 characters at sentence ends.
  - `source` drives the pasted provenance line.
- `PUT /bookmarks/{id}/content` with `{ text }` of 200–100,000 characters, on a non-private bookmark: stores the text escaped as paragraphs with `metadata.extraction = { status: complete, provider: user_paste }`, clears the code, and enqueues a full reprocess.

**Failure codes.**
- Fetch codes keep their names; `pending` after retries becomes `provider`.
- Summarise `unusableReason` becomes the enum `paywall | consent | error_page | empty | other`, mapping to `paywall | blocked | unavailable | empty | empty`.
- `paywall` is the model's judgement (`bookmark.processor.prompt.ts:145`).

**Tokens.** `tokens.json` gains `color.mobile.{light,dark}` overrides. The generator validates override names against canonical color keys and resolves aliases after merging overrides for mobile only; `tokens.css` is unchanged. All other tokens retain Signal values.

| Token | Light | Dark |
|---|---|---|
| `accent` | `#5A2950` | `#E3B9DA` |
| `accent-hover` | `#6E3563` | `#D4A5CB` |
| `accent-fg` | `#FCF7FB` | `#2A1026` |
| `accent-soft` | `#F4E8F1` | `#36202F` |
| `accent-border` | `#D9BCD2` | `#6B4462` |
| `focus` | `{accent}` | `{accent}` |

**Flags:** none (internal TestFlight, additive backend).

### 8.5 Key flows

N/A: request/queue path in §8.2; queue drain and picks ordering in §8.4.

### 8.6 Error handling and edge cases

| Condition | System behaviour | User sees (§7) |
|---|---|---|
| Duplicate URL | §8.4 “Writes” precedence | Already-saved status |
| Sign-out revocation failed | Do not clear the key or session until DELETE is acknowledged | S-15 “Connect to finish signing out” + Retry |
| Share token missing or revoked | Extension queues; on 401 it clears the rejected shared-key item after retaining its userId on the queue row. App foreground reissues the missing key after sign-in | S-7 queued |
| Share offline | Offline, 5xx or 8 s timeout → queued | S-7 queued |
| Rate limited (429) | Extension queues with `notBefore` = `Retry-After` | S-7 queued |
| Replay: 429 | Entry kept until `notBefore` | Queued card |
| Save request failed | Replay 400 → failed row. 401/another user’s entry → kept for matching sign-in. Network/5xx → kept | S-23: 400 “Couldn't save this link” + Remove; else Retry + Remove |
| No http(s) URL; app group full (200) | No request | S-7 no-link / queue-full |
| Android share signed out | Queued; drains after sign-in. Offline: queued, then the app closes | Sign-in / S-20 queued |
| Time zone changes | Unknown `tz` → 400 and a client retry with `UTC`. The requested zone determines localDate and refreshesAt. A different localDate can create a new set; the same localDate reuses the existing immutable set regardless of zone. DST days are 23 or 25 h | Possibly a new set |
| 0 eligible, or before 06:00 | No row (`computedAt` absent), retried on each load / the previous date's set | S-2 / yesterday's set |
| Set exists, none visible | `computedAt` present, `items` empty; never recomputed that day. No All 0 done or same-day replacement promise | §7 no-visible-picks state |
| Saved or still processing after compute | Excluded from today’s set (FR-6, FR-15); queued/pending/failed captures stay above picks | CaptureStatus above / completed card below |
| Pick snoozed before 19:00 to Tonight | Hidden until `later_until`, back in its slot via `revealsAt` | N drops, then returns |
| Snooze to ≥ `refreshesAt`; archived, deleted, Not for me | Hidden (D-14); snoozed saves re-enter eligibility on their `later_until` day | N drops |
| Not for me Undo | Undo restores own save and sends nothing (FR-12). Non-own: only deferred feedback. Kill before feedback: accepted archive remains; non-own cards may reappear. No durable action queue | S-18 |
| Action while offline | Done, Later, Not for me, Move and note apply optimistically and revert with a toast on network failure. A Home load failure keeps the last list and shows the offline Notice | S-1 Notice, S-18 |
| Action on a non-own card | FR-13 and its criterion | S-3 reduced |
| Picks request fails | Rest of For you renders | S-1 picks error |
| Fetch failure, or summarise unusable | §8.3 Shared processor; code per §8.4 | S-16 |
| Paste out of range / private link / unusable | 400 / 409 / code set | S-21 / no Paste / S-16 |
| Private save | Existing soft extract/file uses the supplied description, never fetches the page; any brief identifies that source | Title/description fields; “From your description” |
| Content 404 or offline | No complete content, a private link, or no network | S-11 Read empty or offline |
| Old brief-reader highlights and progress | Unplaced highlights stay in the list; progress is monotonic | Unchanged |

### 8.7 Security and privacy

- Share-key controls are in §8.4 (NFR-9). A leaked key can submit URLs and learn bookmark ids/already-saved status, but cannot retrieve owner content or mutate note/snooze.
- Keychain is `THIS_DEVICE_ONLY` (§8.4); app-group entries hold URLs and queue metadata until drained.
- Private fields: §8.4 (D-3).
- Pasted text is escaped and stays inside the untrusted-source framing (`bookmark.processor.prompt.ts:137-140`).

### 8.8 Observability and analytics

- G-1 to G-6 are weekly read-only queries over `bookmarks`, `daily_picks` and `feed_feedback`; no analytics SDK.
- G-2: done picks during their own 06:00–06:00 pick day / user-days with a `daily_picks` row; measures eligible-pick days, not visits.
- G-4: saves per UTC calendar week / distinct users who saved or marked done that week (`created_at` / `read_at`); measures saving/reading, not visits. Snapshot before release; apply identically to 8 baseline and 4 release weeks.
- G-5: pick-day `not_interested` / originally stored slots, before hides; Undo before send does not count.
- `queued_save_lost`: before release, §8.10 airplane-mode proof; after release, `queue_age_s` (`capture_queued_at` → `created_at`) in `Bookmark created` (DOC-2). > 86,400 or a tester-reported failed row counts as a loss until explained.

Logs carry no key value or note text.

| Log | Properties |
|---|---|
| `Picks computed` | user_id, local_date, time_zone, eligible_count, picked_count, picks_ms |
| `Picks served` | user_id, local_date, visible_count, done_count |
| `Bookmark created` (extended) | capture_source, capture_platform, queued, queue_age_s, already_saved |
| `Share key issued` / `revoked` / `rejected` | user_id, key_id |
| `Processing failure classified` | bookmark_id, phase, code |

### 8.9 Rollout, migration and rollback

- **Release unit.** One PR to `main`, squash-merged (D-13). `main` is unprotected (`gh api …/branches/main/protection` → 404). Approval does not authorise the merge.
- **PR checks.** `accessibility.yml`, `mobile-pr.yml`.
- **Pre-merge** (backend CI runs after merge): `bun run typecheck` (web); `bunx tsc --noEmit -p` separately for api, worker, shared and mobile tsconfigs; `bun run test:db`; `bun run apispec` with the client committed; `eas build --profile preview` from the branch through the device checklist; the keychain capability on both bundle IDs (A-2).
- **On merge.** `deploy-backend.yml` runs tests, then `supabase db push`, then API and worker. `deploy-mobile.yml` makes internal builds. `deploy-web.yml` rebuilds because the contract paths changed.
- **TestFlight.** Dispatched by hand after `deploy-backend` succeeds. Earlier internal builds fall back per §8.6 "Picks request fails".
- **Rollback.** Backend: revert the commit; the migration stays, unused. Mobile: the previous TestFlight build, or `ios_build_id` (`deploy-mobile.yml:21-24`). Share keys: revoke all rows, and the extensions queue instead.

### 8.10 Test strategy

| Level | What it proves |
|---|---|
| shared jest | Eligibility, domain cap, 06:00/DST, failure mapping, no Open Graph fallback, blocks, precedence |
| API tests | NFR-2, 3, 5, 9; visibility, zero-eligible, owner-only, private fields, paste |
| `api-contract.test.ts` | NFR-10; `userNote` absent from public models |
| Mobile jest + RNTL | NFR-4, 6–8; queue matching, Next pick, FR-11 times, non-own cards |
| `tokens:check` | Overrides change only `theme.ts` |
| Device checklist | NFR-1; one bookmark per share; offline drain; revoked key; Android return; two-device picks |

## 9. Risks and dependencies

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Keychain/profile misconfigured; extension always queues | Medium | Medium | Pre-merge device build | Architect |
| `expo prebuild --clean` drops the extension | Low | High | `disableIOS: true`; rule in `IMPLEMENTATION.md`; a test checks the Swift path | Architect |
| Post-merge backend test failure blocks the deploy while mobile builds | Medium | Medium | Pre-merge `test:db`; picks fallback | Architect |
| Model judges a readable page unusable | Low | Medium | Open original and Paste stay available; the code is logged | Architect |

## 10. Decisions

User approved scope/direction on 2026-11-09, D-21 on 2026-11-10, and this written spec/prototype on 2026-11-10 (“approved”). Lead clarifications preserve those constraints. Approval covers the design; further phase authorization is recorded separately.

| ID | Decision / basis | Decider |
|---|---|---|
| D-1 | Session prototype direction: Signal, plum, standalone app with tweaks; replaces earlier mobile proposal. | User |
| D-2 | Specify the app prototyped in this session. | User |
| D-3 | FR-16/FR-19 preserve existing social privacy. | Lead, existing rule |
| D-4 | First spec Save + Today’s 5; remaining capabilities in ordered BACKLOG.md. Consolidated by D-13. | User |
| D-5 | Native iOS save-and-close; Android saves without a tap. Avoid making capture another task. | User |
| D-6 | FR-11 timing; no notifications. | User |
| D-7 | Timeline, rich cards, plum; exploratory layouts/density/accent switches stay out. | User |
| D-8 | Mobile says Topics; data and web keep Collections. | Lead, approved prototype |
| D-9 | Mobile-only accent extension; web ink retained until its own spec. | User |
| D-10 | Clipboard detection without reading; explicit paste tap avoids unsolicited permission prompts. | User |
| D-11 | Finite For-you tail; limits in FR-14. | User |
| D-12 | §2 goals, guardrails and flat-result response. | User |
| D-13 | Scope lock: first release is one complete backend/mobile package and PR; exclusions in BACKLOG.md. | User |
| D-14 | Snoozed picks retain slots without backfill, so daily choices stay stable. | User |
| D-15 | FR-11 gesture/button distinction follows prototype. | Lead, approved prototype |
| D-16 | FR-17 navigation. | User |
| D-17 | Mobile type check and Jest on PRs. | User |
| D-18 | Extension captures only; optional note/timing in app. | Lead, D-5 |
| D-19 | Keep existing Continue reading row. | Lead, code/prototype |
| D-20 | FR-29 scopes retain code/prototype behavior. | Lead, code/prototype |
| D-21 | Save-only share key over mirrored expiring JWT; no refresh in extension. **ADR candidate.** | User |
| D-22 | §8.4–6 unify failures, Undo, durable capture attribution and optimistic/revert actions. | Lead, evidence |
| D-23 | Digests Open only; absent digest feedback contract does not justify adding one. | Lead, schema evidence |

Reuse bookmark PATCH and BookmarkService: separate Later routes/content service add no behavior. Persist daily picks because ranker sessions are process-local; use Postgres zone math. Capture columns survive metadata replacement. Blank unusable briefs because metadata cannot prove article content. One deduplicated queued create carries note/timing (§8.4 precedence).

## 11. Assumptions and open questions

- **A-1** Only internal testers use the app (App Store Connect 6758127357). If wrong, keep a compatibility window.
- **A-2** The extension can read expo-secure-store `accessGroup` items, and EAS profiles carry the capability. Verified by the pre-merge build; if wrong, the bridge writes the item.
- **A-3** Hermes returns an IANA zone; if not, add `expo-localization`.
- **A-4** `BackHandler.exitApp()` after `ACTION_SEND` returns to the sender; if not, `moveTaskToBack`.
- **A-7** Retired: §7 defines Paste for every supported iOS version.

| ID | Chosen rule / observation | Owner | Trigger/date | If check fails | Decided by/source |
|---|---|---|---|---|---|
| DOC-1 | Picks p95 from `picks_ms` | Architect | 7 days after TestFlight | > 800 ms → index or cap at 300 | NFR-2 |
| DOC-2 | `queue_age_s` > 86,400, plus tester failed-row reports | PM | 7 and 28 days | Any → block wider rollout | D-12 |

**Readiness:** Ready for breakdown. Architect rehearsed capture, replay, picks, Later, private/paste and release ordering; no unanswered implementation decisions. The rehearsal confirmed crash-safe share/replay, immutable cross-device picks and Later visibility, private/pasted content boundaries, and compatible one-package release ordering. RY-1…4 closed: required private title/description, all-consumer compile proof, native Paste on supported iOS15.x, and future-only snooze bounds with elapsed replay/Undo normalization. Native/API outcome proofs remain implementation gates (§8.10).

## 12. Glossary

**Pick day:** local 06:00-to-06:00 period, identified by starting date.

**Pick:** an own bookmark selected for that day; excludes digests and followed saves.

**Done:** the bookmark’s existing read state, shared across clients.

**Later:** a per-bookmark snooze time, without a notification.

**Topic:** mobile name for a Collection; data model unchanged.

**Saved on this phone:** durable queued capture awaiting server acceptance.
