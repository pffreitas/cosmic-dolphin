# Cosmic Dolphin — Functional Specification

The revamp changes what the product *does*, not only how it looks. This directory specifies the
behaviour; [`docs/design-system/`](../design-system/) specifies the interface. Neither is enough on
its own to build a screen.

Written to be read by coding agents as well as people. Where a document says **exists**, the
capability is already in the codebase and must not be rebuilt. Where it says **new**, it is part of
this revamp.

## Read in this order

| Document | Scope |
| --- | --- |
| [01-product-model.md](./01-product-model.md) | Objects, the two organising modes, the principles every feature is judged against. |
| [02-capture.md](./02-capture.md) | Saving a link: entry points, dedupe, private links, immediate feedback. |
| [03-ai-pipeline.md](./03-ai-pipeline.md) | Extract → summarise → tag → file. Phases, states, failure, surfacing. |
| [04-library.md](./04-library.md) | Collections, AI filing, read state, reading progress, highlights, search. |
| [05-feed.md](./05-feed.md) | Home ranking, item types, digests, scopes, feedback loop. |
| [06-social.md](./06-social.md) | Follow, like, comment, share, reshare, profiles, privacy. |
| [07-data-model.md](./07-data-model.md) | Current schema, and every table and column this revamp adds. |
| [08-api-surface.md](./08-api-surface.md) | Endpoints to add or change in `packages/apispec`. |

## Scope

**In scope.** The ranked Home feed and the signals that drive it. The social graph — following,
comments, reshares — and the privacy model around it. AI filing into an editable collection tree,
AI digests, and provenance on every AI output. Reading progress and highlights. The full UI revamp
onto Signal.

**Out of scope for this revamp.** Teams and shared collections. Notifications and email digests.
Full-text reader mode for paywalled sources. Mobile parity beyond token adoption. Monetisation.

## Non-negotiables

Behavioural counterparts to the design system's rules. A feature that violates one of these is
wrong regardless of how well it is built.

1. **Saving never blocks.** A pasted URL produces a usable row before any AI work begins.
2. **AI never destroys user intent.** It suggests filing, tags, and summaries; a user decision
   always wins and is never silently overridden.
3. **Every AI output names its sources.** No summary, digest, or ranking explanation ships without
   provenance the user can inspect.
4. **Private by default.** A save is visible only to its owner until the user explicitly shares it.
5. **Ranking optimises for usefulness, not engagement.** No metric that rewards outrage, no
   "trending", no autoplay.
6. **The Library is chronological first.** AI organisation is an overlay on that order, never a
   replacement for it.
