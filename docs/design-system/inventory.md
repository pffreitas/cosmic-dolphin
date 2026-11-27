# Source and coverage inventory

Baseline: web `4c8d362`, 2026-11-26. Links are current source owners, not independent alternative
specs. All component paths below are under `apps/web/components`. Detailed visual contracts:
[components](./components.md), [patterns](./patterns.md); verification: [parity](./parity.md).

## Production pattern ownership

| Family | Reusable implementation | Consumers and important states |
| --- | --- | --- |
| App frame | [AppChrome](../../apps/web/components/app-chrome.tsx), [AppShell](../../apps/web/components/shell/app-shell.tsx), [Sidebar](../../apps/web/components/shell/sidebar.tsx) | signed-in/public/bare; active destination, failed counts, nested collections, sheet, drag targets |
| Omnibox/capture | [HeaderOmnibox](../../apps/web/components/header-omnibox.tsx), [NewBookmark](../../apps/web/components/bookmark/new-bookmark.tsx), [PrivateLinkDialog](../../apps/web/components/bookmark/private-link-dialog.tsx) | URL/search/blank; saving, dedupe, rate limit, private link; shared dialog and toast |
| Capture feedback | [PendingCaptures](../../apps/web/components/bookmark/pending-captures.tsx), [CaptureToast](../../apps/web/components/bookmark/capture-toast.tsx), [SavingNow](../../apps/web/components/feed/saving-now.tsx) | optimistic arrivals, retry/remove, Home strip vs global rows; provider/store owns lifecycle |
| Feed | [FeedItem](../../apps/web/components/feed/feed-item.tsx), [HomeView](../../apps/web/components/feed/home-view.tsx), [HomeRail](../../apps/web/components/feed/home-rail.tsx) | article/video/digest/pending/lead/row; loading, scope empty, first save, offline, error, next-page error |
| Library | [LibraryRow](../../apps/web/components/bookmark/library-row.tsx), [LibraryView](../../apps/web/components/bookmark/library/library-view.tsx), [LibraryDnd](../../apps/web/components/shell/library-dnd.tsx) | Inbox/nested, read/unread, loading/empty, selection, sort, bulk actions, filing suggestion, drag/refile |
| Provenance | [ProvenanceRow](../../apps/web/components/provenance-row.tsx) | actor/source/time/duration, source links and disclosure; reused in feed/detail/search/palette |
| Callout | [AiCallout](../../apps/web/components/ai/ai-callout.tsx), [ProcessingSteps](../../apps/web/components/ai/processing-steps.tsx) | summary/digest/suggestion/answer, regular/compact, progress stack/inline and failure |
| Detail | [BookmarkDetail](../../apps/web/components/bookmark/detail/bookmark-detail.tsx), [CosmicBrief](../../apps/web/components/bookmark/detail/cosmic-brief.tsx), [OwnSummary](../../apps/web/components/bookmark/detail/own-summary.tsx) | owner/public, ready/processing/private/failed, regenerate, share, mark read, delete, offline |
| Reader | [Reader](../../apps/web/components/bookmark/detail/reader.tsx), [ReaderProse](../../apps/web/components/bookmark/detail/reader-prose.tsx), [SelectionPopover](../../apps/web/components/bookmark/detail/selection-popover.tsx) | rich text, scroll progress, highlights and selection; private/public permissions |
| Social | [ActionRow](../../apps/web/components/social/action-row.tsx), [CommentThread](../../apps/web/components/social/comment-thread.tsx), [CommentDrawer](../../apps/web/components/social/comment-drawer.tsx), [ReportDialog](../../apps/web/components/social/report-dialog.tsx) | optimistic like/save, share failure, zero/abbreviated counts; replies/edit/delete/report/block; inline/drawer |
| Identity/profile | [ProfileView](../../apps/web/components/profile/profile-view.tsx), [FollowButton](../../apps/web/components/profile/follow-button.tsx), [EditProfileDialog](../../apps/web/components/profile/edit-profile-dialog.tsx), [HandleClaimPrompt](../../apps/web/components/social/handle-claim-prompt.tsx) | self/other/blocked, save/collection/like tabs, follow states, validation and claim prompt |
| Search | [SearchView](../../apps/web/components/search/search-view.tsx), [SearchRow](../../apps/web/components/search/search-row.tsx), [SearchAnswer](../../apps/web/components/search/search-answer.tsx), [GlobalCommandDialog](../../apps/web/components/global-command-dialog.tsx) | literal/semantic, filters, source-first streaming answer, independent list/answer errors, palette actions |
| Explore | [ExploreView](../../apps/web/components/explore/explore-view.tsx), [ExploreRail](../../apps/web/components/explore/explore-rail.tsx) | topic selection including outside top four, empty graph/topic, pagination and comment drawer |
| Compact nav | [BottomNavigation](../../apps/web/components/mobile/bottom-nav.tsx) | web compact tabs/actions, active routes, safe areas; not Expo tab implementation |
| Brand | [Logo](../../apps/web/components/brand/logo.tsx), [Logo CSS](../../apps/web/components/brand/logo.module.css), [asset guide](../../assets/branding/README.md) | capsule/tile, compact public header, both themes, native assets |
| Marketing | [LandingPage](../../apps/web/components/marketing/landing-page.tsx), [landing CSS](../../apps/web/components/marketing/landing-page.css), [module](../../apps/web/components/marketing/landing.module.css), [frame](../../apps/web/components/marketing/landing-frame.tsx), [demo](../../apps/web/components/marketing/reading-demo.tsx) | forced light; interactive local samples/media; responsive crop; separate marketing typography |
| Auth | [AuthShell](../../apps/web/app/(auth-pages)/auth-shell.tsx), [FormMessage](../../apps/web/components/form-message.tsx) | sign-in/up/forgot/reset, provider actions, form errors; shared brand/primitives |

Data/formatting source seams: `lib/identity.ts`, `lib/capture.ts`, `lib/reading/*`, feed-data,
row-data, search-data and profile-data modules next to their patterns. Preserve Unicode, unsigned
hash, count boundaries, URL normalization, public slug and owner-specific behavior across adapters.
Do not reimplement backend ranking/processing rules inside a UI renderer.

## Supporting primitive defaults

The main component contracts are in components.md. These additional source files stay in the web
vocabulary but must not all be promoted to native production primitives indiscriminately.

| Primitive | Source | Observed contract / caveat |
| --- | --- | --- |
| DropdownMenu | [dropdown-menu.tsx](../../apps/web/components/ui/dropdown-menu.tsx) | panel/border/md/popover shadow; portal, focus/keyboard menu semantics, checkbox/radio/submenu parts. Copy actual item classes for an adapter, not OS default menu styling. |
| Checkbox | [checkbox.tsx](../../apps/web/components/ui/checkbox.tsx) | 16px visible box, sm radius, primary border/checked fill, 16px check; disabled .5. Library's selection gutter is a separate caller implementation; do not replace it with this default size. |
| Separator | [separator.tsx](../../apps/web/components/ui/separator.tsx) | 1px line; horizontal or vertical; decorative by default. |
| Label | [label.tsx](../../apps/web/components/ui/label.tsx) | sans 14px/500 line 1; disabled peer opacity .7. Distinct from 11.5px group-label type role. |
| ScrollArea | [scroll-area.tsx](../../apps/web/components/ui/scroll-area.tsx) | Radix viewport with 10px scrollbar, 1px padding and pill border-strong thumb; app also uses CSS thin quiet scrollbars; preserve actual scroll owner. |
| Breadcrumb | [breadcrumb.tsx](../../apps/web/components/ui/breadcrumb.tsx) | Generic primitive. LibraryRow and detail own collection breadcrumb composition; use those patterns for parity. |
| Card | [card.tsx](../../apps/web/components/ui/card.tsx) | Legacy shadcn rounded-xl/shadow styling. Feed/Library do not use this as their visual frame. Not a replacement for FeedItem or Callout. |
| Progress | [progress.tsx](../../apps/web/components/ui/progress.tsx) | Generic 8px/pill track with primary/20 and translated primary fill; not the reader's 2px hairline. |
| Collapsible | [collapsible.tsx](../../apps/web/components/ui/collapsible.tsx) | Behavioral Radix exports, no independent visual style. |
| HoverCard | [hover-card.tsx](../../apps/web/components/ui/hover-card.tsx) | Desktop hover behavior; native must expose necessary information without hover. |
| Carousel | [carousel.tsx](../../apps/web/components/ui/carousel.tsx) | Generic Embla wrapper. Home continue-reading is its own snapping layout; do not infer matching visuals from the name. |
| Focus | [focus-ring.ts](../../apps/web/components/ui/focus-ring.ts) | 2px focus token, 2px outward offset/bg backing; field inset ring; composite focus-within wrapper. |
| Inline code | [inline-code.tsx](../../apps/web/components/typography/inline-code.tsx) | UI inline code; reader has its own rich-text rule. |

## Fixture and route coverage

| Reference | What it proves | What it does not prove |
| --- | --- | --- |
| `/dev/patterns` | production pattern gallery with illustrative data | auth/network/native behavior or every overlay variant |
| `/dev/library` | Library composition and sample states | real collection permissions or transport timing |
| `/dev/bookmark` | detail rendering and sample states | actual highlight persistence or signed-out slug contract |
| `/dev/home` | Home edition, first-save/feed samples | real ranking, clocks, pagination transport |
| Actual `/search`, `/explore`, `/my/profile`, `/u/[handle]` | screen-specific composition | a complete deterministic fixture set; add fixed cases during native implementation |
| Actual `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/protected/reset-password` | marketing/auth frames | native keyboard/provider UI equivalence |
| Actual `/s/[slug]`, `/bookmarks/[bookmarkId]` | public/owner permission-specific composition | loading/error boundary existence |

`app/dev/dev-shell.tsx` owns fixture framing, not the production auth/shell path. Existing static
accessibility tests and lint are useful floors, not screenshot or physical-device tests. The
historical audit's missing route loading/error boundaries must not be presented as implemented
four-state parity. Native state proofs (account switch, durable capture acknowledgement, offline
rollback, public-slug isolation) remain governed by AGENTS.md and the approved feature spec.

## Historical and excluded material

`docs/design-system/prototypes/*`, `components/design-system-prototype/*`,
`components/home-brief-prototype/*`, `components/ui/shadcn-io/rotating-text/*`, vendored
`components/ai-elements/*`, and dead pre-revamp `components/realtime/ConnectionStatus.tsx` are not
blanket authority for new product components. Confirm route reachability before adopting one.
User-owned untracked logo studies/mobile concepts are not part of this reconciliation. Keep
historical experiments available without allowing them to override the current production reference.
