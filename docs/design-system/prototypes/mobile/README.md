# Cosmic Dolphin mobile prototype

Open [index.html](./index.html) in a browser. It is a self-contained, offline HTML prototype with embedded Inter and Source Serif 4 fonts, inline icons and illustrative content. No build, account, environment variables or backend are required.

The screen picker explores twelve destinations; **All screens** compares them side by side. **Dark mode** changes the phone surfaces. The state selector demonstrates ready, loading, empty, error, processing and offline states for Home, Library, topic collections, Search and bookmark detail.

## Scope and evidence

This is the mobile design proposal requested after the web revamp. It extends Signal onto phone workflows. Earlier exclusions of mobile parity in `PRODUCT.md` and the functional specification describe the previous revamp; this prototype does not rewrite those documents or claim that proposed mobile capabilities are implemented.

Reviewed against the current mobile Expo routes, `BookmarkCard`, mobile navigation and generated theme, web Home and Explore implementations, the web prototype conventions, and the design-system and functional specifications. The web design's two organising modes, sourced AI output, private saves, user-controlled filing and reading-first priorities remain binding.

All names, sources, counts, excerpts and discussions are sample content. The built-in `.example` domains intentionally do not represent live article sources. User-entered links retain their original URL and can be opened explicitly from the captured save. The reader excerpt was written for this prototype. The social and authentication actions are local demonstrations. Nothing is posted, emailed, published or sent to an API.

## What changes

| Area | Current mobile experience | Proposed experience |
| --- | --- | --- |
| Home | Generic unread bookmark list | Unified discovery feed with personalized topic collections, multi-link editions, reading resumption and following scope |
| Library | Same bookmark cards with read filters | Chronological separator rows, visible filing, collection navigation, sort and accessible row actions |
| Capture | Share-intent route | In-app save sheet plus existing system share intent; private-link fallback; immediate pending save |
| Detail | Bookmark view | Source-first hero, sourced Cosmic brief, key points, reading action, private notes and conversation |
| Reading | Detail content | Dedicated reading canvas, adjustable type, progress, private highlights and explicit completion |
| Search | Search route | Title/idea query, related-in-meaning labels, collection and read filters, useful no-result recovery |
| Discovery | Separate Explore placeholder | Combined into Home, with topic filters, people to follow and personalized reading lists |
| Profile | Basic account screen | Public saves separated from private library/highlights; edit profile and grouped settings |
| First use | Auth routes | Concrete first-save example and focused sign-in/reset flows |
| Resilience | Spinners and generic errors | Geometric skeletons, specific empty states, inline recovery, staged processing, offline notice |

## Interaction walkthroughs

- **Capture:** persistent Save action → enter an http(s) link → Save to Inbox → immediate private row and nonblocking staged processing. The login-page alternative accepts a title and note.
- **Read:** open a save → inspect Cosmic brief and source → continue to article → highlight the sample passage → mark read → Library → Read filter. Completion can be undone.
- **Organise:** Library → Collections → choose a collection. Row actions → Move to collection preserves your placement. Archive removes the row; Undo restores it. New collections appear in the collection chooser.
- **Retrieve:** Search → enter a title or idea → submit. Filters constrain collection and read status. A nonsense query demonstrates recovery without losing navigation.
- **Share:** Share → explicitly select Make this save public → create a demonstration public link. Notes and highlights remain private. Public access can be turned off again.
- **Discuss:** feed/detail comment action → sample discussion → add a local comment.
- **Preferences:** You → Settings → appearance or text size. Reader appearance applies immediately. Profile edits survive navigation during the session.

## Signal and native translation

The prototype inherits the palette, two type voices, shape meanings and border-first surfaces from `../../tokens.json`. It introduces no production token changes. Raw palette declarations are contained in the prototype's theme block; this HTML is not a new production component system. The device frame and presentation controls are review tooling.

For Expo implementation, reuse `constants/theme.ts`, `constants/fonts.ts`, `useTheme`, existing API-client boundaries and authentication. Compose shared mobile primitives rather than copying per-screen styles. Use native navigation stacks, system share UI, accessible action sheets, native selection/highlighting, platform insets and keyboard avoidance. Scale type with system preferences; the browser's fixed device frame is not a Dynamic Type implementation.

The four-slot navigation contains Home, Library, Save and You. Save is an action, not a destination; validate its presentation against native tab-bar conventions during implementation (three destination tabs with an adjacent capture action is an alternative). Explore has been absorbed into Home. Search is a focused pushed screen.

## State contract

| State | Prototype treatment | Production requirement |
| --- | --- | --- |
| Loading | Content-shaped title and row skeletons | Keep navigation and filters responsive; retain existing data during refresh |
| Empty | Specific copy and a next action | Distinguish first-use, empty collection/filter and empty social graph |
| Error | Inline reason and retry | Preserve cached data and source access; show actual recoverable API errors |
| Processing | Saved row with fetched/extracted/summarising/filing stages | Subscribe to real processing events; never invent progress percentages |
| Offline | Notice above existing illustrative content | Show only genuinely cached content; queue captures only after durable local storage is implemented |
| Ready | Illustrative populated content | Use real API data and reconcile optimistic changes |

## Implementation sequence

1. Shared mobile primitives and navigation: source row, list row, segments, sheet, skeleton, toast and state panels. Preserve the existing share-intent ingress.
2. Library and capture: chronological paging, collection tree, filing overrides, filters, deduplication, durable optimistic save/retry.
3. Bookmark detail and reader: summaries/provenance, extraction/private-source fallback, progress persistence, highlights, notes and read state.
4. Home: personalized topic collections, public-source discovery, feed scopes, resume state and source-backed connections.
5. Search, topic-collection detail and profile: wire existing web capabilities through `@cosmic-dolphin/api-client`; start any missing endpoint changes in TypeSpec, then run `bun run apispec`.
6. First use, account recovery and settings; verify iOS and Android insets, keyboard, back gestures, screen readers, large text and both appearances.

## Verification and limits

Browser checks cover 12 screens at 360, 390, 728 and 1120px (48 combinations), 25 async state combinations, save processing, read filtering, highlights, archive/undo, search no-results, collection filtering and explicit sharing consent. There were no script exceptions or horizontal overflows in that matrix. An independent finish review found captured-row and resume-identity bugs; a second review verified both fixes as resolved. Rendered light, dark, phone, desktop and all-screen views were inspected.

Prototype buttons use 44px minimum touch heights, with labelled icon buttons, visible focus rings, dialog focus containment, Escape dismissal and inert background content. The documentation pass identified short title-link and toast Undo targets; both now have a 44px minimum height. Reduced-motion preference disables custom motion. The palette comes from Signal's audited tokens; native accessibility and full screen-reader conformance are not certified by these browser checks.

The standalone prototype simplifies the type system to two embedded families and uses local type sizes. Reconcile typography with canonical tokens during implementation; these are not additions to the design system. Inputs use the 8px radius specified in the canonical component documentation.

Simplifications: session-only state; fixed sample feed ranking and social counts; staged processing is manually selected rather than backed by jobs; semantic search uses a small illustrative matching rule; highlighting marks a predetermined passage; sharing demonstrates consent rather than generating/copying a real URL; sign-in does not authenticate; offline preview is not an offline cache. Native devices, tablet layouts, system share extension behavior, system text scaling and real services remain implementation validation work.

Fonts: Inter (Rasmus Andersson) and Source Serif 4 (Adobe), embedded from Google Fonts under the SIL Open Font License. License text is supplied in `FONT-LICENSES.txt`.

The Impeccable detector reported one warning: Inter is a commonly used font. Inter is retained because it is an explicit Signal system commitment; no new font direction was introduced.

## Unified Home revision

Home is now the discovery surface; the separate Explore destination has been removed. For you contains AI-curated multi-link editions such as **Latest on AI**, **Self improvement** and **Designing a slower internet**. Following remains a secondary Home scope. The reader can filter by topic, open its complete link list, save an individual recommendation, hide a topic with Undo, or update explicit interests.

These editions are recommendations, distinct from the private collection tree in Library. Discovered articles enter Library only when the user explicitly saves them. The prototype renders the editorial connection and source domains for each edition. Topic detail is a pushed screen with a route back to Home, rather than a separate top-level destination.

Production personalization should combine explicit interests with reading/saving signals and a controlled amount of adjacent-topic discovery. The topic list and AI-created collections should evolve with those signals; every edition needs a source set, freshness information and feedback controls. The “Latest on AI” label here uses illustrative links, not live news. Real freshness, retrieval, clustering and ranking remain backend work in shared services and pgmq, behind contract-first APIs. Private Library folders must never be created, moved or shared by a recommendation.

Revision checks cover removing Explore, filtering Home topics, navigating into a topic and article, explicitly saving a recommendation into Library, excluding unsaved recommendations from private Library/Search, changing interests, hiding/undoing a topic, and retaining the reading/capture flows. An independent revision review verified fixes for article topic context and saving from detail; focused checks also cover returning to the correct topic. All twelve prototype screens remain available; Topic collection replaces Explore in the screen picker.

The latest revision removes recommendation-explanation links and dialogs from Home, topic detail and topic menus. Source attribution, editorial connections, interests and topic feedback remain available.
