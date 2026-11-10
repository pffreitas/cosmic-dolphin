# Mobile reading app: backlog

Spec each numbered item independently, in this order. The first spec covers Save + Today’s 5; the remaining items preserve the full approved product direction without expanding that release.

## 1. Save + Today’s 5

**Outcome:** save from another app safely enough to close the tab, then read a finite set of saved links each day.
**Includes:** native share capture and persisted save queue; Save sheet with note and Read when; server-owned daily picks and reasons; Done, Later, Undo, Next pick; Brief, Read and Original; failed-save recovery; mobile plum accent.
**Spec:** [2026-11-09-save-and-todays-5.md](./2026-11-09-save-and-todays-5.md).
**Status:** spec and prototype approved on 2026-11-10; [ten-task breakdown](./2026-11-09-save-and-todays-5/tasks.md) approved on 2026-11-10; ready for implementation.

## 2. Ask with numbered sources
**Outcome:** one field finds saves or answers a question from them, with tappable numbered sources. You can also ask a single article or a whole topic.
**Includes:** unified search and ask with `[n]` citations; Ask this article with the cited paragraph; Ask this topic; suggested questions and recent searches.
**Backend gaps:**
- `/search/ask` cites by title, not number (`packages/shared/src/services/search.service.ts:290`), and takes only `query` (`packages/apispec/search.tsp:56-59`).
- There is no bookmark-scoped ask.
- Chunks carry positions (`supabase/migrations/20250922000000_create_content_chunks_tables.sql`).
**Depends on spec 1:** `GET /bookmarks/{id}/content` blocks as the citation unit, and the bookmark page.
**Open:**
- Do suggested questions come from the server or from topic names?
- What is the per-user ask rate limit?
- Web parses the same stream, so it needs a compatibility check for the new `cited` event.

## 3. Library of topics
**Outcome:** Library answers "what do I have", with AI-built topics as covers and a topic page that summarises what its saves say.
**Includes:**
- search entry and counts;
- topic covers, the "Yours" flag and the new-topic suggestion card;
- Inbox;
- topic AI summary ("From n saves", rebuilt when the topic changes by a fifth);
- sub-topics with Unread/All/Done and sort;
- rename, merge, hide;
- shelves Continue and Quick reads;
- format filter chips;
- the "n under 5 min" count on Home's end.

**Backend gaps:**
- There is no collection summary, merge, hide, or AI-versus-user origin (`packages/apispec/collections.tsp`).
- Reading time isn't filterable (`GetBookmarksQuery`, `packages/apispec/bookmarks.tsp:190-225`).
- No format field exists (`packages/shared/src/types.ts:127-142`).

**Depends on spec 1:** the tab bar and Library entry (FR-17), Move (FR-18).
**Open:**
- Are format chips host-derived (video, thread, paper, tool) or AI-classified (recipes)?
- What threshold rebuilds a summary?
- Mobile says "Topics" while data and web say "Collections" (D-8).

## 4. Offline downloads and bulk paste
**Outcome:** the morning picks read fully on a train, and a pasted list becomes separate saves.
**Includes:** every brief on the phone; full text downloaded for Today's picks, with a "Brief only" pill; bulk paste with duplicates skipped.
**Backend gaps:**
- None beyond spec 1's `/content`.
- The 100 saves/day limit applies (`apps/api/src/plugins/rate-limit.ts:60-63`).
- The bookmark cache holds loaded items only (`apps/mobile/lib/bookmark-cache.ts`).
**Depends on spec 1:** `GET /picks/today`, `/content`, the persisted save queue (FR-27).
**Open:**
- Storage cap and retention days.
- What a bulk paste over the daily limit shows.
- How offline is detected without a new dependency.

## 5. Patterns and formats
**Outcome:** a pattern across several saves reads as one piece with agree, differ and built-from, and each format gets the card it needs.
**Includes:**
- digest page with agree/differ;
- a digest as one of Today's picks, with a done state;
- format cards (video chapters and shortcut, unrolled thread, recipe ingredients, paper finding, tool);
- the Numbers and Quote brief sections;
- the Watch & listen shelf;
- "Connects to n of your saves".

**Backend gaps:**
- `Digest` has no agree/differ fields and no read state (`packages/apispec/digests.tsp:22-100`).
- There is no structured extraction or format classification.
- There is no related-saves endpoint.

**Depends on spec 1:** the pick set and its N rule (FR-7, FR-9), the Brief tab (FR-20).
**Open:**
- Does a digest-as-pick count toward the 5 or sit beside them?
- What is the extraction cost per save?

## 6. Plum accent on web
**Outcome:** web uses the plum accent that mobile ships.
**Includes:** web tokens and contrast audit for the D-9 pair.
**Gaps:** `apps/web` tokens and the design-system rule text in `docs/design-system/README.md`.
**Depends on:** spec 1's plum tokens in `tokens.json`.
**Open:** whether plum replaces the web's ink accent or sits beside it.

## 7. Collections → Topics on web
**Outcome:** web uses the same word as mobile.
**Includes:** copy and route labels on web. The data model keeps `collections`.
**Depends on:** item 3's naming decision.
**Open:** whether `/my/collections` URLs redirect.

## Cut
| Capability | Reason |
|---|---|
| Listen (audio player) | Not requested; no text-to-speech exists |
| "From 6 months ago" resurface card and one-page guide | New AI generation, not requested |
| Time-sensitive shelf | Needs date extraction for one shelf |
| Chrome "save all tabs" and newsletter forwarding | Not mobile; no extension app exists in `apps/` |
| Topic suggestion at save | Filing is asynchronous, so a suggestion before it runs would block saving (`docs/functional-spec/README.md:39`) |
