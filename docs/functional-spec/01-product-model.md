# 01 · Product model

## What Cosmic Dolphin is

A bookmark tool that makes saved links consumable. Saving is the easy part and every product solves
it; the backlog that follows is where they fail. Cosmic Dolphin's job is to turn a pile of saved
links into something a person actually reads, using AI to summarise and organise, and a social layer
to surface what is worth attention.

The product feel is a **calm intelligent reading network**. Not a productivity dashboard, not a
dopamine feed. The primary user is a curious professional or creator with a backlog of essays, docs,
papers, videos, and threads.

## Objects

| Object | Status | Description |
| --- | --- | --- |
| **Bookmark** | exists | The canonical unit. A saved URL owned by one user, with extracted content, an AI summary, AI tags, a collection placement, read state, and optional public sharing. |
| **Collection** | exists | A named, hierarchical folder (`parent_id`) owned by a user. Created by AI or by hand; the two are indistinguishable to the user. |
| **Profile** | exists | A user's public identity — name, picture, and the saves they have made public. |
| **Like** | exists | A user's endorsement of a bookmark. |
| **Processing run** | exists | A durable timeline of the AI pipeline for one bookmark, with per-phase token and cost accounting. |
| **Follow** | new | A directed edge from one user to another. The spine of the feed's social scope. |
| **Comment** | new | A threaded discussion attached to a bookmark. |
| **Reshare** | new | A bookmark saved from someone else's, carrying provenance back to the original. |
| **Digest** | new | An AI-authored feed item that groups several of the user's own saves into one observation. |
| **Highlight** | new | A user-selected span inside a bookmark's extracted content. |
| **Reading progress** | new | How far through a bookmark's content the user has read. |

A bookmark belongs to exactly one user. Two people saving the same URL produce two bookmarks; they
are related through `saved_from_bookmark_id` when one was reshared from the other, and through the
URL otherwise.

## Two organising modes

The product has exactly two ways of arranging saved links, and conflating them is the most likely
way to get this revamp wrong.

### Home — the ranked social feed

Algorithmically ordered, mixing the user's own saves, saves from people they follow, and AI digests
built from their library. Ranked by **personal usefulness first, social proof second**. This is the
surface that answers "what should I read now".

### Library — the personal archive

Saved-link first, **chronological by default**, with AI organisation layered on top as an editable
collection tree. Private: no likes, no comments, no counts. This is the surface that answers "what
do I have, and where did I put it".

The same bookmark appears in both. Its treatment differs: the feed shows social context and asks for
attention; the Library shows filing context and asks for retrieval.

## Principles

Every feature decision is judged against these. They come from the design interview recorded in
[`docs/design-system/decisions.md`](../design-system/decisions.md).

**Usefulness over engagement.** Ranking rewards what the user will actually read, not what will keep
them scrolling. Likes are an input, never the objective.

**AI as a quiet editor.** It summarises, groups, tags, and files. It does not chat, does not have a
personality, and does not claim confidence it cannot show a source for.

**Suggestion, not automation.** AI-created collections, tags, and filings are proposals. A user
override is permanent and stops further AI movement of that object.

**Legibility over magic.** Anything the system decides — why an item is in the feed, why a link was
filed where it was — must be inspectable in one click, in plain language.

**Social is secondary.** It is present on every feed item and every public bookmark, and absent from
the Library entirely. The emotional centre stays on "this is worth understanding", not "this is
popular".

**Reading is the success metric.** The product is working when users mark things read, not when they
save more.

## Primary flows

1. **Save** — paste or share a URL → a row appears immediately → the pipeline fills it in → it lands
   in a collection. [02](./02-capture.md), [03](./03-ai-pipeline.md)
2. **Triage** — open Home → scan ranked items with summaries and provenance → open, save, or dismiss.
   [05](./05-feed.md)
3. **Read** — open a bookmark → read the Cosmic brief → read the content → highlight → mark read.
   [04](./04-library.md)
4. **Retrieve** — open Library or the command palette → filter by collection, tag, or read state, or
   search semantically → find the save. [04](./04-library.md)
5. **Share** — make a save public → it gets a slug → followers see it in their feed and can comment
   or reshare. [06](./06-social.md)
