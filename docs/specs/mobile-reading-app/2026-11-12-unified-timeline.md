# Unified mobile timeline

| | |
|---|---|
| Status | Approved by Paulo Freitas on 2026-11-12 |
| Date / owner | 2026-11-12 / Paulo Freitas |
| Size | Small |
| Council | PM ✅ · Architect ✅ · Designer ✅; final read 2026-11-12 |
| Generated with | `/Users/paulo.freitas/.agents/skills/spec` · sha256:4b7583f6a81b9aef4c6e3fbc2dd1eca7411ada5545d48f0ef1fb90689868bbd1 |
| Code revision | `775674e33316acd807d08ec41c21cea2be20a81e`; remote main discovered at `d266cf4e83c0825c896325d230907e3c6133b876` |
| Prototype | [Standalone HTML](./unified-timeline-prototype.html), illustrative fixtures |

## 1. Summary

Simplify mobile Home to one reading feed and a continuous black header. All topics comes first and is selected on fresh open. Keep daily picks and Continue reading inline. Defer the new Today’s 5 swipe viewer and omit its inactive pill. Changes are Home-only; web, Library, ranking and APIs remain unchanged.

**Decisions to review:** D-2 topic lifetime/filter boundary; D-3 deferred pill; D-4 release scope.

## 2. Problem and goals

The user wants to remove audience scopes before full social functionality is available.

| ID | Outcome | Baseline → target | Proof |
|---|---|---|---|
| G-1 | Open Home without choosing a feed scope | Three scope controls → zero | Home runtime and integration tests |

**Primary outcome test:** open Home with picks, Continue and tagged feed items; select a topic, restore All topics, open/return from reading, Done/Undo and switch accounts. Observe the approved header and usable existing flows without old-account topics. A screenshot alone is insufficient.

**Non-goals:** reels/swipe viewer, chronological sorting, endless feed, social/backend changes, manual TestFlight submission.

## 3. Current state

References below use the code revision above.

- Home has local scope/topic state and separate picks/Continue/tail: `apps/mobile/app/(tabs)/index.tsx:42-82,104-125`.
- `useHomeFeed("for_you")` loads feed, picks, Continue and counts; pagination is disabled: `apps/mobile/hooks/useHomeFeed.ts:40-45,87-98`.
- Screen shares safe-area/body background; TopBar uses theme colors and BrandSignature: `apps/mobile/components/ui/Signal.tsx:34-45`, `components/TopBar.tsx:35-56`.

**Constraints:** semantic mobile tokens only; preserve web and shared primitive defaults. This supersedes the previous Save + Today’s 5 spec’s FR-29 scopes, not its other shipped behavior.

## 4. Users and scenarios

Existing authenticated library owners on iOS/Android; no new roles or permissions. Scenarios: initial Home, topic round trip, reader return, refresh/failure and account switch.

## 5. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Home shall use the existing `for_you` feed without For you, Following or Unread scope controls. | Must |
| FR-2 | All topics shall always be first, including no-topic/loading/error states; initialize selected on fresh Home mount and account change. Preserve same-account selection on ordinary reader/tab return. | Must |
| FR-3 | Topic presses shall preserve current local tail-only filtering, topic derivation/order and server ranking. Picks/progress, Continue and capture statuses remain unfiltered. | Must |
| FR-4 | Home shall have solid-black safe area, brand/action bar and persistent topic strip in both themes, white controls and no gradient brand capsule; body and other screens retain existing styling. | Must |
| FR-5 | Omit the Today’s 5 header pill until its separate swipe-viewer task; preserve existing inline daily picks/progress. | Must |
| FR-6 | Preserve refresh, all async states, capture, reading/navigation, Done/Later/Undo, Save and the finite feed/Library exit. | Must |

**Acceptance criteria:** FR-1/6 preserve existing picks/reasons, deduplication and maximum ten-item tail. FR-2/3 topic→All topics restores the tail without requests; returning from reading preserves the topic. FR-4 search/profile and status-bar glyphs remain readable; leaving Home restores normal appearance. FR-5 exposes no dead viewer action. Owner/refresh boundaries follow §8.6.

## 6. Non-functional requirements

| ID | Requirement / target | Verification |
|---|---|---|
| NFR-1 | Zero new endpoints, dependencies or topic-selection requests; zero effective web color changes | Transport tests, token checks and diff |
| NFR-2 | Zero account-A topics/selection/content presented as account B | Held-completion Home/provider regression |
| NFR-3 | Text ≥4.5:1, meaningful focus/control contrast ≥3:1, targets ≥44px; no lost controls at system font scales 1 and 2 | Token/semantic tests and simulator proof in both themes |
| NFR-4 | Zero failing required local/PR checks | §8.8–8.9 |

## 7. UX design

S-1 Home only. Header reading order: brand, Search, Your profile, All topics, available topics, content. Topic strip stays beneath the brand bar while content scrolls. Existing source states remain: skeleton loading, first-run/no-picks empty, whole/partial failure Retry, offline cache/notice, capture processing and completed content/Undo. No new motion or permissions.

Reuse Screen, TopBar, BrandSignature, Chip and existing feed/action primitives through optional Home-only appearance inputs. Prototype uses fictional content and existing frame/assets, not production-data evidence; it models topic selection and existing reading/save flows. Native typography/dynamic type remain authoritative where HTML differs.

## 8. Technical solution

### 8.1–8.3 Approach and components

Directly refine Home composition and add opt-in header styling to existing primitives. Delete unreachable Home scope branches, not shared API/hook scope support. Place topics as a sibling above FlatList; no sticky-scroll machinery. Reject new feed hooks/endpoints and any scope-union/ranker rewrite. Add mobile header semantic tokens in `tokens.json`, regenerate themes, document their meaning. Keep shared defaults unchanged.

### 8.4 Contracts and data

Home passes constant `"for_you"` to existing `useHomeFeed(scope: FeedScope)`. Keep cache keys, API scope enums, public/private routing and owner-bound actions unchanged. Topics still derive from loaded feed bookmark `cosmicTags`; not a whole-Library taxonomy. No schemas, migrations or new persistence.

### 8.5 Flows

N/A: existing data/action flows are reused without new sequencing.

### 8.6 Error handling and edge cases

| Condition | Behavior |
|---|---|
| Account changes / old read settles | Synchronously fence topic/selection and owner data; stale completions cannot affect the new account |
| Selected topic disappears on completed same-owner refresh | Fall back to All topics; transient loading alone does not reset selection |
| No topics / failure / offline | Keep All topics and existing loading/retry/cache notices |
| Cursor returned | Preserve finite default-feed behavior; no pagination |

### 8.7 Security and privacy

No new data access or permissions; retain provider/cache/action owner fences and public-slug routing. Test component-local privacy, not only cache isolation.

### 8.8 Test strategy

Test-first Home/primitive/token regression tests, then complete mobile Jest, mobile lint, TypeScript, API generation and token drift checks. Retain generic API/hook scope tests; replace only removed-scope Home expectations. Simulator proof covers default/topic/reader-return, black status area in both themes, large text and action navigation. Label physical-device and normal-session spoken accessibility as unproven; they are not claimed by simulator evidence.

### 8.9 Delivery and rollback

One feature PR from current remote main, not the unrelated landing-page branch, to `main`; squash merge after cumulative Sol review and all checks/feedback pass on exact head/base. Live GitHub currently has no enforced main protection/rulesets; this does not waive gates. PR checks: Mobile lint, types and Jest; Rule ten. Local commands: `bun run apispec`, mobile lint, `bunx tsc --noEmit -p apps/mobile/tsconfig.json`, mobile Jest `--ci --runInBand`, `bun run tokens:check`.

Merge auto-triggers mobile quality and configured iOS/Android preview scheduling; report scheduling separately from finished builds. No manual dispatch, backend release or TestFlight submission. Paulo owns manual rollout and rollback via a reviewed revert PR. No data rollback needed.

## 9. Risks

Shared styling could recolor unrelated screens: require Home opt-in/default regressions. Topic pills can imply whole-page filtering: preserve the existing explicit FR-3 boundary. Account-local selection can leak: NFR-2 is blocking.

## 10. Decisions and authorization

- **D-1 User:** approved black header and removal of scope tabs.
- **D-2 User latest correction:** All topics first/selected on open. Exact FR-2/3 lifetime and tail-only boundary approved through “Approve spec (Recommended)” on 2026-11-12.
- **D-3 User:** Today’s 5 horizontal swipe experience deferred. FR-5 pill omission approved in the same written-spec approval.
- **D-4 Full-send:** “Approved, implement it and full send” grants implementation/PR/merge; written spec/prototype approval completed, subsequent task-plan approval remains pending. Preserve this grant; do not ask for it again.

## 11. Readiness and assumptions

No unknown service contract. Default/pill choices are explicitly approved. Council final read and Architect readiness passed; independent simplification and concise-writing passes completed. Prototype click checks passed default/topic restore, detail/profile return, Library/Home and both-theme black header with zero page errors. User approved the exact written scope/prototype on 2026-11-12. Full-send resumes after task-plan approval; product implementation has not started.

## 12. Glossary

Unified feed: existing finite ranked Home composition, not a chronological union or the full Library.
