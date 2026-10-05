# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The Next.js app (`apps/web`) is the product surface and the subject of the current revamp. The Expo
app (`apps/mobile`) is a secondary client that shares the token source and the API; it does not have
a design language of its own, and parity beyond token adoption is out of scope for this revamp.

## Users

Curious professionals and creators with a backlog of saved essays, docs, papers, videos and threads.
They save more than they read. They come to Cosmic Dolphin in two situations: deciding what to read
now (Home), and finding something they already saved (Library). Reading a single save, then talking
about it, is the third.

## Product Purpose

A bookmark tool that makes saved links consumable. Saving is the easy part and every product solves
it; the backlog that follows is where they fail. Cosmic Dolphin turns a pile of saved links into
something a person actually reads: it summarises and organises with AI, and uses a social layer to
surface what is worth attention.

Success is reading, not saving. The product is working when users mark things read.

## Positioning

Most read-later tools stop at saving. Cosmic Dolphin turns the backlog into reading: a sourced brief
for every save, AI filing you can always override, and a feed ranked by what you will actually read,
not by popularity.

## Operating Context

- **Two organising modes, never conflated.** Home is a ranked social feed (the user's saves, saves
  from people they follow, and AI digests), ordered by personal usefulness first and social proof
  second. Library is the private archive: chronological by default, with AI organisation laid over it
  as an editable collection tree. The same bookmark appears in both, treated differently.
- **Primary flows:** save (paste or share a URL; a row appears at once and the pipeline fills it in)
  → triage on Home → read (Cosmic brief, then the content, highlights, mark read) → retrieve
  (Library, filters, semantic search, command palette) → share (public slug, comments, reshares).
- **Pipeline:** extract → summarise → tag → file, run in the background and shown as quiet staged
  progress inside the item, never as a blocking spinner.
- The full behaviour lives in `docs/functional-spec/`; the interface specification lives in
  `docs/design-system/`. Both are binding for any UI or feature work.

## Capabilities and Constraints

- **Terminology:** bookmark (a "save" in copy), collection, Library, Home, Explore, Cosmic brief,
  key points, digest, highlight, reshare, Inbox, Read later, Archive. "Cosmic is reading it" is how
  the product speaks about the pipeline at work.
- **Non-negotiables** (functional-spec README): saving never blocks; AI never destroys user intent;
  every AI output names its sources; private by default; ranking optimises for usefulness, not
  engagement (no outrage metrics, no "trending", no autoplay); the Library is chronological first.
- **Exists vs new:** the functional spec marks each capability as existing or new. Existing
  capabilities are not rebuilt.
- **Out of scope for this revamp:** teams and shared collections, notifications and email digests,
  full-text reader mode for paywalled sources, mobile parity beyond tokens, monetisation.
- **Technical:** API contract first (`packages/apispec` → generated `@cosmic-dolphin/api-client`);
  AI calls live in `packages/shared`; background work goes through pgmq. See `CLAUDE.md`.

## Brand Commitments

- **Name:** Cosmic Dolphin. "Cosmic" is a quiet metaphor for depth and connection: subtle brand,
  serious product. No dolphin motifs in app chrome. The brandmark is a drawn arc over a point of
  light; it replaced the 🐬 emoji, which is not used in the product.
- **Voice:** calm, plain, sentence case everywhere. Explanations are one sentence, in the second
  person, in plain language ("why this appeared"). Errors name the problem and the way back.
- **AI has no personality.** It is a quiet editor: it does not chat, does not announce itself as AI,
  and does not claim confidence it cannot show a source for.
- **Visual authority:** the adopted direction is Signal, specified in `docs/design-system/`
  (`README.md` lists the ten rules that do not bend; `tokens.json` is the source of every value).
  `docs/design-system/decisions.md` records the 20 decisions and their revisions behind it.

## Evidence on Hand

- **Pre-launch / private.** There are no public users, testimonials, usage metrics, customer logos,
  case studies or press. Future work must not invent any, and must not imply a user base ("trusted
  by", "join thousands").
- Marketing illustrations are the product's own components on illustrative content
  (`apps/web/components/marketing/vignettes.tsx`), marked inert. Never screenshots, never a mock
  drawn to look like the app.
- The `/dev/*` routes (`/dev/bookmark`, `/dev/library`, `/dev/patterns`) hold illustrative fixtures.
  Names, sources and counts in them are sample content, not evidence.

## Product Principles

1. **Reading is the success metric.** Prefer the change that gets a save read over the one that gets
   more saved or more scrolled.
2. **Suggestion, not automation.** AI proposes filing, tags and summaries; a user decision always wins
   and stops further AI movement of that object.
3. **Legibility over magic.** Anything the system decides — why an item is in the feed, where a link
   was filed, what a summary was built from — is inspectable in one click, in plain language.
4. **Social is secondary.** Present on every feed item and public bookmark, absent from the Library.
   The emotional centre is "worth understanding", not "popular".
5. **Never block, never lose the link.** A pasted URL is a usable row immediately, and a failed run
   still opens the original.

## Accessibility & Inclusion

Accessibility is build-breaking, not polish: 4.5:1 contrast on all text in both light and dark mode,
a visible focus ring on every interactive element, 32px targets (44px on touch), and
`prefers-reduced-motion` honoured everywhere. Enforced in CI by `apps/web/__tests__/accessibility/`
and `apps/web/scripts/lint-a11y.mjs`; `docs/design-system/audit.md` records the checks and the one
accepted deviation.
