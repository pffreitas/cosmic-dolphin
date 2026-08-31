# Smart Home Brief Design

## Goal

Turn the signed-in home dashboard into a fast personalized digest derived only from the user's saved bookmarks. The first version shows up to three source-backed cards: one synthesized insight, one exact attributed quote, and one rediscovered item.

## MVP Scope

- Add a `From Your Library` section to `apps/web/app/(private)/my/dashboard/page.tsx`.
- Load cards from persisted API data. Opening the home page must not perform a live AI request.
- Generate candidate cards asynchronously after bookmark processing succeeds.
- Persist source references for every generated card.
- Allow lightweight reactions: useful, not useful, show less like this, dismiss, and save insight.
- Fall back deterministically to existing saved bookmarks when generated cards are unavailable or the user has too little content.
- Expire or remove generated cards when their source bookmarks are deleted.

## Out Of Scope

- Email briefings.
- Push/mobile notifications.
- Topic-specific modes.
- Monthly trend reports.
- Full contradiction, connection, theme, and question card families.
- A new message broker or scheduler.

## Architecture

The feature adds a dedicated home-brief domain in `packages/shared` backed by three PostgreSQL tables: cards, card sources, and feedback. The API exposes authenticated `GET /api/v1/home-brief` and `POST /api/v1/home-brief/{id}/feedback` routes through TypeSpec and generated client code. The worker calls a new home brief generator after bookmark processing completes; the generator stores candidates ahead of time, so the dashboard reads quickly.

The MVP generator produces three card types:

- `insight`: AI-synthesized from two or three processed bookmarks with cautious wording.
- `quote`: an exact verbatim excerpt from one saved source, verified by substring match before persistence.
- `rediscovery`: deterministic resurfacing of an older bookmark related to recent saves by tag overlap.

## Trust Rules

- Quote cards must store only text that exactly appears in the selected source content.
- Every card must store one or more source rows with bookmark ID, title snapshot, URL snapshot, and optional excerpt.
- Multi-source cards must expose all supporting sources.
- Generated insight copy should use cautious framing such as "Your saved sources suggest that".
- Cards for deleted bookmarks disappear through `ON DELETE CASCADE`; API queries also join against live bookmark rows owned by the requesting user.
- Private links may participate only through user-provided title, description, tags, and generated metadata. The generator must not invent inaccessible source content.

## Ranking

The MVP ranking score is deterministic and inspectable:

```
score = relevance + novelty + quality + serendipity - repetition
```

Signals:

- Relevance: tag/title overlap with the user's recently saved bookmarks.
- Novelty: cards not shown within the configured cooldown score higher.
- Quality: insights supported by multiple sources and quote cards with medium-length excerpts score higher.
- Serendipity: older items related to recent tags get a small boost.
- Repetition: repeated source IDs and repeated card type in the current selection are penalized.

## Empty States

- No saved content: dashboard copy explains that saving content will create a personalized brief.
- One or two items: show deterministic quote/takeaway/rediscovery-style cards from the available items.
- Several items: generate insight, quote, and rediscovery cards.
- Generation failure: return deterministic fallback cards from persisted bookmarks and expose `fallbackReason: "generation_unavailable"`.

## Acceptance Criteria

- The home page displays up to three personalized cards derived only from the user's saved content.
- At least one card is an insight or takeaway when enough processed content exists.
- Quotes exactly match their source text and visibly identify the source.
- Every card can open its associated source or sources.
- A card is not shown again within the configured cooldown period.
- Cards load from persisted data without blocking initial page rendering on an AI request.
- A deterministic fallback is shown when generation fails or insufficient content exists.
- Users can dismiss cards and provide lightweight positive or negative feedback.
- Deleted or inaccessible source content is removed from future summaries.
- The home page remains useful for users with little or no saved content.
