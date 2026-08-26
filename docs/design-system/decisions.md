# Design System — Decision Record

The 20 product decisions the Cosmic Dolphin design system is derived from, captured during the
design-direction interview. These are the *why* behind every rule in `README.md` and every token in
`tokens/`. Revisit this file before proposing a change to the system — if a proposal contradicts a
decision here, the decision has to be reopened first.

| # | Question | Decision |
| --- | --- | --- |
| 1 | What should the product feel like? | **A calm intelligent reading network.** Not a productivity dashboard, not a dopamine feed. |
| 2 | Who is the primary user? | **Curious professionals and creators** with a backlog of essays, docs, papers, videos and threads. |
| 3 | How prominent is the social layer? | **Visible but secondary.** Likes, comments, shares and profiles are present; the emotional centre stays on "worth reading". |
| 4 | What does AI feel like? | **A quiet editorial layer.** Concise summaries, topic grouping, source-backed explanations. Not magic, not a chat assistant. |
| 5 | What is the primary unit? | **Two modes.** Home is an algorithmic social feed; Library is saved-link first, chronological, AI-organised into a tree. |
| 6 | What does feed ranking optimise for? | **Personal usefulness first**, social proof second. Never "most liked wins". |
| 7 | How does Library AI organisation feel? | **Editable filing.** AI proposes categories, tree placement, tags and clusters; the user overrides without a fight. |
| 8 | Feed density? | **Medium with strong hierarchy.** Scannable like YouTube, more contemplative. |
| 9 | How do thumbnails behave? | **Supporting evidence, not decoration.** Text and summary lead; video may lead with its thumbnail. |
| 10 | How strict is the system for coding agents? | **Strict tokens and component patterns, flexible page composition**, shipped as a shared token source both clients consume. |
| 11 | How much playful branding? | **Subtle brand, serious product.** "Cosmic" as a quiet metaphor for depth and connection — no space gradients, no dolphin motifs in app chrome. |
| 12 | Type pairing? | **Modern grotesk sans + literary serif.** Sans for operating the product, serif for evaluating content. |
| 13 | Accent colour? | **Two directions explored separately** — deep blue-cyan (Signal) and amber (Ember) — as distinct systems, not a token swap. |
| 14 | Third direction? | **Near-monochrome precision** (Graphite): mostly neutral, colour only for semantic state, AI provenance and social affordances. |
| 15 | Dark mode? | **First-class, light-led.** Brand defined in light, translated carefully to dark. |
| 16 | Shape language? | **Soft rectangles.** 8px content surfaces, 6px compact controls; pills reserved for tags, avatars, segmented filters and the primary CTA. |
| 17 | How are cards and lists framed? | **Subtle borders and separators over elevated cards.** Library is `divide-y` rows. Cards only for repeated feed posts, dialogs, AI callouts and grouped panels. |
| 18 | How do comments appear? | **Compact action row plus expandable conversation.** Never a full thread inline in the feed. |
| 19 | Source trust and provenance? | **Always visible, compact, inspectable.** Source domain, author/profile, saved/shared context, and an expandable "why this appeared". A system pattern, not one-off copy. |
| 20 | AI processing and loading states? | **Quiet staged progress.** A pasted link becomes a usable pending row immediately, then shows subtle "Extracting", "Summarising", "Filing" steps. No big spinners. |

## Inspiration set

Vercel (precision, restraint, hairlines), Linear (product density, keyboard-first, confident
accent), Craft.do (warmth, paper, reading comfort). Cosmic Dolphin takes the discipline of the
first two and the reading temperature of the third.
