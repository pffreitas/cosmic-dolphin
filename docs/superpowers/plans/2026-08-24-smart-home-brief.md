# Smart Home Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast, source-backed `From Your Library` section to the signed-in home dashboard with up to three persisted cards: insight, quote, and rediscovery.

**Architecture:** Add a home-brief domain in `packages/shared` with persisted card, source, and feedback tables. Expose authenticated API routes through TypeSpec and generated `@cosmic-dolphin/api-client`; generate candidate cards from the existing bookmark-processing worker after content processing succeeds. Render cards on `apps/web/app/(private)/my/dashboard/page.tsx` from persisted API data, using deterministic fallback cards when generated candidates are unavailable.

**Tech Stack:** Bun, Turborepo, TypeScript, PostgreSQL/Supabase, Kysely, pgmq, Fastify, NestJS worker, TypeSpec, Next.js 16 App Router, React 18, Tailwind CSS, Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-08-24-smart-home-brief-design.md`

## Global Constraints

- Use Bun commands, not npm/yarn.
- API contract changes start in `packages/apispec/*.tsp`; run `bun run apispec` after TypeSpec changes.
- Do not manually edit generated files in `packages/api-client`.
- AI calls live in `packages/shared`, not inside API routes or web components.
- Background work uses the existing pgmq queue pattern; do not add a new broker.
- The home page must load persisted data and must not block initial rendering on a live AI request.
- The MVP card set is exactly `insight`, `quote`, and `rediscovery`.
- Quote text must be an exact excerpt from saved source content before it is persisted.
- Every non-empty card response must include one or more source references.
- Deleted source bookmarks must remove affected cards from future home brief responses.
- Authenticated API responses must only return cards belonging to the current user.
- The web MVP is scoped to `apps/web`; mobile rendering is out of scope for this plan.

---

## File Structure

- Create `supabase/migrations/20260824000001_create_home_brief_tables.sql`: persisted cards, card sources, feedback, indexes, and source-delete expiration trigger.
- Modify `packages/shared/src/database/schema.ts`: Kysely table definitions and helper types for the three new tables.
- Modify `packages/shared/src/types.ts`: API/domain DTOs for home brief cards, sources, responses, and feedback actions.
- Create `packages/shared/src/repositories/home-brief.repository.ts`: all DB reads/writes for brief cards, sources, fallback bookmark input, cooldown, and feedback.
- Modify `packages/shared/src/repositories/index.ts`: export the repository.
- Create `packages/shared/src/services/home-brief.ranking.ts`: pure scoring and display-selection helpers.
- Create `packages/shared/src/services/home-brief.prompt.ts`: prompts and structured generation schema text.
- Create `packages/shared/src/services/home-brief.generator.service.ts`: async candidate generation, exact quote validation, insight creation, rediscovery card creation.
- Create `packages/shared/src/services/home-brief.service.ts`: API-facing read, feedback, and deterministic fallback behavior.
- Modify `packages/shared/src/services/index.ts`: export and wire home brief services into `createServiceContainer`.
- Modify `packages/shared/src/test-utils/database.ts`: truncate the new tables in tests.
- Modify `packages/shared/src/test-utils/factories.ts`: add home brief test factories.
- Create `packages/shared/src/__tests__/repositories/home-brief.repository.test.ts`: repository and cooldown coverage.
- Create `packages/shared/src/__tests__/services/home-brief.ranking.test.ts`: deterministic ranking coverage.
- Create `packages/shared/src/__tests__/services/home-brief.generator.service.test.ts`: source-backed generation and quote validation coverage.
- Create `packages/shared/src/__tests__/services/home-brief.service.test.ts`: fallback and feedback coverage.
- Create `packages/apispec/home-brief.tsp`: contract for `GET /home-brief` and `POST /home-brief/{id}/feedback`.
- Modify `packages/apispec/main.tsp`: import the new TypeSpec file.
- Create `apps/api/src/routes/home-brief.ts`: authenticated Fastify route for reading cards and posting feedback.
- Modify `apps/api/src/index.ts`: register the home brief route under `/api/v1`.
- Create `apps/api/src/tests/home-brief.test.ts`: route validation helper tests.
- Modify `apps/worker/src/queue/tokens.ts`: add home brief generator injection token.
- Modify `apps/worker/src/queue/queue.module.ts`: provide the home brief repository and generator.
- Modify `apps/worker/src/queue/handlers/bookmark-processor.handler.ts`: enqueue generation after bookmark processing succeeds, logging failures without failing the bookmark job.
- Create `apps/web/lib/api/home-brief.ts`: server API client for dashboard rendering.
- Create `apps/web/lib/api/home-brief-client.ts`: browser API client for feedback actions.
- Create `apps/web/components/home-brief/HomeBriefSection.tsx`: client component for card rendering, source links, and actions.
- Create `apps/web/components/home-brief/home-brief-card.test.tsx`: markup tests for source attribution and empty states.
- Modify `apps/web/app/(private)/my/dashboard/page.tsx`: render the `From Your Library` section.

---

### Task 1: Add Home Brief Persistence

**Files:**
- Create: `supabase/migrations/20260824000001_create_home_brief_tables.sql`
- Modify: `packages/shared/src/database/schema.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/test-utils/database.ts`
- Modify: `packages/shared/src/test-utils/factories.ts`

**Interfaces:**
- Produces DB tables: `home_brief_cards`, `home_brief_card_sources`, `home_brief_feedback`.
- Produces types:
  - `HomeBriefCardType = "insight" | "quote" | "rediscovery"`
  - `HomeBriefFeedbackAction = "useful" | "not_useful" | "show_less_like_this" | "dismiss" | "save_insight"`
  - `HomeBriefCard`, `HomeBriefCardSource`, `GetHomeBriefResponse`, `HomeBriefFeedbackRequest`

- [ ] **Step 1: Create the failing typecheck baseline**

Run:

```bash
cd packages/shared && bun run build
```

Expected: PASS before changes. If it fails, record the existing failure before editing.

- [ ] **Step 2: Add the migration**

Create `supabase/migrations/20260824000001_create_home_brief_tables.sql`:

```sql
CREATE TABLE IF NOT EXISTS home_brief_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    card_type text NOT NULL CHECK (card_type IN ('insight', 'quote', 'rediscovery')),
    title text NOT NULL,
    body text NOT NULL,
    explanation text NOT NULL,
    content_hash text NOT NULL,
    score numeric NOT NULL DEFAULT 0,
    ranking_reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'dismissed', 'expired')),
    generation_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    available_on date DEFAULT current_date NOT NULL,
    expires_at timestamp with time zone,
    last_shown_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    saved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS home_brief_card_sources (
    card_id uuid NOT NULL REFERENCES home_brief_cards(id) ON DELETE CASCADE,
    bookmark_id uuid NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    source_role text NOT NULL CHECK (source_role IN ('primary', 'supporting', 'quote')),
    excerpt text,
    title_snapshot text NOT NULL,
    source_url_snapshot text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (card_id, bookmark_id, source_role)
);

CREATE TABLE IF NOT EXISTS home_brief_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id uuid NOT NULL REFERENCES home_brief_cards(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('useful', 'not_useful', 'show_less_like_this', 'dismiss', 'save_insight')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(card_id, user_id, action)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_home_brief_cards_user_content_hash
ON home_brief_cards(user_id, card_type, content_hash);

CREATE INDEX IF NOT EXISTS idx_home_brief_cards_user_ready
ON home_brief_cards(user_id, status, available_on, score DESC);

CREATE INDEX IF NOT EXISTS idx_home_brief_cards_last_shown
ON home_brief_cards(user_id, last_shown_at);

CREATE INDEX IF NOT EXISTS idx_home_brief_card_sources_bookmark_id
ON home_brief_card_sources(bookmark_id);

CREATE INDEX IF NOT EXISTS idx_home_brief_feedback_user_card
ON home_brief_feedback(user_id, card_id);

CREATE TRIGGER update_home_brief_cards_updated_at
  BEFORE UPDATE ON home_brief_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION expire_home_brief_card_after_source_delete()
RETURNS trigger AS $$
BEGIN
    UPDATE home_brief_cards
    SET status = 'expired', updated_at = now()
    WHERE id = OLD.card_id AND status = 'ready';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expire_home_brief_card_when_source_deleted
  AFTER DELETE ON home_brief_card_sources
  FOR EACH ROW EXECUTE FUNCTION expire_home_brief_card_after_source_delete();
```

- [ ] **Step 3: Extend Kysely schema**

Add to `packages/shared/src/database/schema.ts`:

```ts
export type HomeBriefCardType = "insight" | "quote" | "rediscovery";
export type HomeBriefCardStatus = "ready" | "dismissed" | "expired";
export type HomeBriefSourceRole = "primary" | "supporting" | "quote";
export type HomeBriefFeedbackAction =
  | "useful"
  | "not_useful"
  | "show_less_like_this"
  | "dismiss"
  | "save_insight";

export interface HomeBriefCardsTable extends BaseTable {
  user_id: string;
  card_type: HomeBriefCardType;
  title: string;
  body: string;
  explanation: string;
  content_hash: string;
  score: number;
  ranking_reasons: any;
  status: HomeBriefCardStatus;
  generation_batch_id: string;
  generated_at: Generated<Date>;
  available_on: string;
  expires_at: Date | null;
  last_shown_at: Date | null;
  dismissed_at: Date | null;
  saved_at: Date | null;
}

export interface HomeBriefCardSourcesTable {
  card_id: string;
  bookmark_id: string;
  source_role: HomeBriefSourceRole;
  excerpt: string | null;
  title_snapshot: string;
  source_url_snapshot: string;
  created_at: Generated<Date>;
}

export interface HomeBriefFeedbackTable {
  id: Generated<string>;
  card_id: string;
  user_id: string;
  action: HomeBriefFeedbackAction;
  created_at: Generated<Date>;
}
```

Add the tables and helper types:

```ts
export interface Database {
  collections: CollectionsTable;
  bookmarks: BookmarksTable;
  bookmark_likes: BookmarkLikesTable;
  scraped_url_contents: ScrapedUrlContentsTable;
  content_chunks: ContentChunksTable;
  text_chunks: TextChunksTable;
  image_chunks: ImageChunksTable;
  profiles: ProfilesTable;
  home_brief_cards: HomeBriefCardsTable;
  home_brief_card_sources: HomeBriefCardSourcesTable;
  home_brief_feedback: HomeBriefFeedbackTable;
}

export type HomeBriefCardRecord = Selectable<HomeBriefCardsTable>;
export type NewHomeBriefCardRecord = Insertable<HomeBriefCardsTable>;
export type HomeBriefCardUpdate = Updateable<HomeBriefCardsTable>;
export type HomeBriefCardSourceRecord = Selectable<HomeBriefCardSourcesTable>;
export type NewHomeBriefCardSourceRecord = Insertable<HomeBriefCardSourcesTable>;
export type HomeBriefFeedbackRecord = Selectable<HomeBriefFeedbackTable>;
export type NewHomeBriefFeedbackRecord = Insertable<HomeBriefFeedbackTable>;
```

- [ ] **Step 4: Add shared API/domain types**

Add to `packages/shared/src/types.ts`:

```ts
export type HomeBriefCardType = "insight" | "quote" | "rediscovery";

export type HomeBriefFeedbackAction =
  | "useful"
  | "not_useful"
  | "show_less_like_this"
  | "dismiss"
  | "save_insight";

export type HomeBriefFallbackReason =
  | "no_content"
  | "low_content"
  | "generation_unavailable";

export interface HomeBriefCardSource {
  bookmarkId: string;
  title: string;
  sourceUrl: string;
  role: "primary" | "supporting" | "quote";
  excerpt?: string;
}

export interface HomeBriefCard {
  id: string;
  type: HomeBriefCardType;
  title: string;
  body: string;
  explanation: string;
  sources: HomeBriefCardSource[];
  savedAt?: Date;
  generatedAt: Date;
}

export interface GetHomeBriefResponse {
  cards: HomeBriefCard[];
  fallbackReason?: HomeBriefFallbackReason;
}

export interface HomeBriefFeedbackRequest {
  action: HomeBriefFeedbackAction;
}

export interface HomeBriefFeedbackResponse {
  card: HomeBriefCard;
}
```

- [ ] **Step 5: Keep test cleanup accurate**

Change `clearDatabase` in `packages/shared/src/test-utils/database.ts`:

```ts
await sql`TRUNCATE home_brief_feedback, home_brief_card_sources, home_brief_cards, image_chunks, text_chunks, content_chunks, bookmark_likes, scraped_url_contents, bookmarks, collections CASCADE`.execute(db);
```

- [ ] **Step 6: Add test factories**

Add to `TestDataFactory` in `packages/shared/src/test-utils/factories.ts`:

```ts
static createHomeBriefCard(overrides: Partial<NewHomeBriefCardRecord> = {}): NewHomeBriefCardRecord {
  return {
    user_id: TestDataFactory.generateUserId(),
    card_type: "insight",
    title: "Today in your library",
    body: "Your saved sources suggest that steady practice beats short bursts of intensity.",
    explanation: "Selected because multiple recent saves mention habit systems.",
    content_hash: crypto.randomUUID(),
    score: 10,
    ranking_reasons: { relevance: 4, novelty: 2, quality: 3, serendipity: 1, repetition: 0 },
    status: "ready",
    available_on: new Date().toISOString().slice(0, 10),
    ...overrides,
  };
}
```

Import `NewHomeBriefCardRecord` from `../database/schema`.

- [ ] **Step 7: Run build**

Run:

```bash
cd packages/shared && bun run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260824000001_create_home_brief_tables.sql packages/shared/src/database/schema.ts packages/shared/src/types.ts packages/shared/src/test-utils/database.ts packages/shared/src/test-utils/factories.ts
git commit -m "feat(shared): add home brief persistence model"
```

---

### Task 2: Add Repository And Ranking Core

**Files:**
- Create: `packages/shared/src/repositories/home-brief.repository.ts`
- Create: `packages/shared/src/services/home-brief.ranking.ts`
- Create: `packages/shared/src/__tests__/repositories/home-brief.repository.test.ts`
- Create: `packages/shared/src/__tests__/services/home-brief.ranking.test.ts`
- Modify: `packages/shared/src/repositories/index.ts`

**Interfaces:**
- Consumes: Kysely `Database`, `BookmarkRepository.findByUser`, and the home brief tables from Task 1.
- Produces:
  - `HomeBriefRepository`
  - `HomeBriefCardWithSourcesRecord`
  - `rankHomeBriefCards(cards, options)`
  - `selectDisplayCards(cards, options)`

- [ ] **Step 1: Write repository tests**

Create `packages/shared/src/__tests__/repositories/home-brief.repository.test.ts` with tests for persistence, ownership filtering, cooldown, and feedback:

```ts
import { beforeEach, describe, expect, it } from "@jest/globals";
import { getTestDatabase, clearDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { HomeBriefRepositoryImpl } from "../../repositories/home-brief.repository";

describe("HomeBriefRepository", () => {
  const db = getTestDatabase();
  let bookmarks: BookmarkRepositoryImpl;
  let repository: HomeBriefRepositoryImpl;
  let userId: string;

  beforeEach(async () => {
    await clearDatabase(db);
    bookmarks = new BookmarkRepositoryImpl(db);
    repository = new HomeBriefRepositoryImpl(db);
    userId = TestDataFactory.generateUserId();
  });

  it("creates cards with source snapshots", async () => {
    const bookmark = await bookmarks.create(TestDataFactory.createBookmark({ user_id: userId, title: "Systems Article" }));

    const [card] = await repository.createCards([
      {
        card: TestDataFactory.createHomeBriefCard({ user_id: userId, card_type: "quote", title: "Quote worth revisiting" }),
        sources: [{
          bookmark_id: bookmark.id,
          source_role: "quote",
          excerpt: "Consistency matters more than intensity.",
          title_snapshot: "Systems Article",
          source_url_snapshot: bookmark.source_url,
        }],
      },
    ]);

    expect(card.sources).toHaveLength(1);
    expect(card.sources[0].bookmark_id).toBe(bookmark.id);
    expect(card.card_type).toBe("quote");
  });

  it("does not return dismissed cards or cards inside cooldown", async () => {
    const bookmark = await bookmarks.create(TestDataFactory.createBookmark({ user_id: userId }));
    const [ready] = await repository.createCards([{ card: TestDataFactory.createHomeBriefCard({ user_id: userId, content_hash: "ready" }), sources: [{ bookmark_id: bookmark.id, source_role: "primary", excerpt: null, title_snapshot: bookmark.title || "Untitled", source_url_snapshot: bookmark.source_url }] }]);
    const [shown] = await repository.createCards([{ card: TestDataFactory.createHomeBriefCard({ user_id: userId, content_hash: "shown", last_shown_at: new Date() }), sources: [{ bookmark_id: bookmark.id, source_role: "primary", excerpt: null, title_snapshot: bookmark.title || "Untitled", source_url_snapshot: bookmark.source_url }] }]);
    await repository.recordFeedback(userId, shown.id, "dismiss");

    const cards = await repository.findDisplayCards(userId, { limit: 3, cooldownDays: 7, now: new Date() });

    expect(cards.map((card) => card.id)).toEqual([ready.id]);
  });
});
```

- [ ] **Step 2: Run repository tests to verify failure**

Run:

```bash
cd packages/shared && bun run test -- home-brief.repository.test.ts --runInBand
```

Expected: FAIL because `HomeBriefRepositoryImpl` does not exist.

- [ ] **Step 3: Create repository implementation**

Create `packages/shared/src/repositories/home-brief.repository.ts`:

```ts
import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  HomeBriefCardRecord,
  HomeBriefCardSourceRecord,
  NewHomeBriefCardRecord,
  NewHomeBriefCardSourceRecord,
  HomeBriefFeedbackAction,
} from "../database/schema";

export interface NewHomeBriefCardWithSources {
  card: NewHomeBriefCardRecord;
  sources: Omit<NewHomeBriefCardSourceRecord, "card_id" | "created_at">[];
}

export interface HomeBriefCardWithSourcesRecord extends HomeBriefCardRecord {
  sources: HomeBriefCardSourceRecord[];
}

export interface FindDisplayCardsOptions {
  limit: number;
  cooldownDays: number;
  now: Date;
}

export interface HomeBriefGenerationInput {
  id: string;
  sourceUrl: string;
  title: string | null;
  cosmicBriefSummary: string | null;
  cosmicSummary: string | null;
  cosmicTags: string[] | null;
  isPrivateLink: boolean;
  createdAt: Date;
  content: string | null;
}

export interface HomeBriefRepository {
  createCards(cards: NewHomeBriefCardWithSources[]): Promise<HomeBriefCardWithSourcesRecord[]>;
  findDisplayCards(userId: string, options: FindDisplayCardsOptions): Promise<HomeBriefCardWithSourcesRecord[]>;
  recordShown(userId: string, cardIds: string[], shownAt: Date): Promise<void>;
  recordFeedback(userId: string, cardId: string, action: HomeBriefFeedbackAction): Promise<HomeBriefCardWithSourcesRecord | null>;
  hasGeneratedSince(userId: string, since: Date): Promise<boolean>;
  findGenerationInputs(userId: string, limit: number): Promise<HomeBriefGenerationInput[]>;
  findFallbackBookmarks(userId: string, limit: number): Promise<HomeBriefGenerationInput[]>;
}

export class HomeBriefRepositoryImpl extends BaseRepository implements HomeBriefRepository {
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async createCards(cards: NewHomeBriefCardWithSources[]): Promise<HomeBriefCardWithSourcesRecord[]> {
    return this.executeQuery(async () => {
      const created: HomeBriefCardWithSourcesRecord[] = [];
      for (const input of cards) {
        const card = await this.db
          .insertInto("home_brief_cards")
          .values(input.card)
          .onConflict((oc) => oc.columns(["user_id", "card_type", "content_hash"]).doNothing())
          .returningAll()
          .executeTakeFirst();
        if (!card) continue;
        if (input.sources.length > 0) {
          await this.db.insertInto("home_brief_card_sources").values(input.sources.map((source) => ({ ...source, card_id: card.id }))).execute();
        }
        const hydrated = await this.findByIdForUser(input.card.user_id, card.id);
        if (hydrated) created.push(hydrated);
      }
      return created;
    }, "createHomeBriefCards");
  }

  async findDisplayCards(userId: string, options: FindDisplayCardsOptions): Promise<HomeBriefCardWithSourcesRecord[]> {
    const cooldownCutoff = new Date(options.now);
    cooldownCutoff.setDate(cooldownCutoff.getDate() - options.cooldownDays);
    const today = options.now.toISOString().slice(0, 10);

    return this.executeQuery(async () => {
      const cards = await this.db
        .selectFrom("home_brief_cards")
        .selectAll()
        .where("user_id", "=", userId)
        .where("status", "=", "ready")
        .where("available_on", "<=", today)
        .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", options.now)]))
        .where((eb) => eb.or([eb("last_shown_at", "is", null), eb("last_shown_at", "<", cooldownCutoff)]))
        .orderBy("score", "desc")
        .orderBy("generated_at", "desc")
        .limit(options.limit * 4)
        .execute();

      return this.hydrateCards(cards).then((hydrated) => hydrated.filter((card) => card.sources.length > 0).slice(0, options.limit));
    }, "findDisplayCards");
  }

  async recordShown(userId: string, cardIds: string[], shownAt: Date): Promise<void> {
    if (cardIds.length === 0) return;
    await this.executeQuery(async () => {
      await this.db.updateTable("home_brief_cards").set({ last_shown_at: shownAt }).where("user_id", "=", userId).where("id", "in", cardIds).execute();
    }, "recordHomeBriefShown");
  }

  async recordFeedback(userId: string, cardId: string, action: HomeBriefFeedbackAction): Promise<HomeBriefCardWithSourcesRecord | null> {
    return this.executeQuery(async () => {
      await this.db.insertInto("home_brief_feedback").values({ user_id: userId, card_id: cardId, action }).onConflict((oc) => oc.columns(["card_id", "user_id", "action"]).doNothing()).execute();
      if (action === "dismiss" || action === "show_less_like_this") {
        await this.db.updateTable("home_brief_cards").set({ status: "dismissed", dismissed_at: new Date() }).where("id", "=", cardId).where("user_id", "=", userId).execute();
      }
      if (action === "save_insight") {
        await this.db.updateTable("home_brief_cards").set({ saved_at: new Date() }).where("id", "=", cardId).where("user_id", "=", userId).execute();
      }
      return this.findByIdForUser(userId, cardId);
    }, "recordHomeBriefFeedback");
  }

  async hasGeneratedSince(userId: string, since: Date): Promise<boolean> {
    return this.executeQuery(async () => {
      const row = await this.db.selectFrom("home_brief_cards").select("id").where("user_id", "=", userId).where("generated_at", ">=", since).limit(1).executeTakeFirst();
      return !!row;
    }, "hasHomeBriefGeneratedSince");
  }

  async findGenerationInputs(userId: string, limit: number): Promise<HomeBriefGenerationInput[]> {
    return this.findBookmarkInputs(userId, limit, false);
  }

  async findFallbackBookmarks(userId: string, limit: number): Promise<HomeBriefGenerationInput[]> {
    return this.findBookmarkInputs(userId, limit, true);
  }

  private async findByIdForUser(userId: string, cardId: string): Promise<HomeBriefCardWithSourcesRecord | null> {
    const card = await this.db.selectFrom("home_brief_cards").selectAll().where("id", "=", cardId).where("user_id", "=", userId).executeTakeFirst();
    if (!card) return null;
    const [hydrated] = await this.hydrateCards([card]);
    return hydrated ?? null;
  }

  private async hydrateCards(cards: HomeBriefCardRecord[]): Promise<HomeBriefCardWithSourcesRecord[]> {
    if (cards.length === 0) return [];
    const sources = await this.db.selectFrom("home_brief_card_sources").selectAll().where("card_id", "in", cards.map((card) => card.id)).execute();
    return cards.map((card) => ({ ...card, sources: sources.filter((source) => source.card_id === card.id) }));
  }

  private async findBookmarkInputs(userId: string, limit: number, allowUnprocessed: boolean): Promise<HomeBriefGenerationInput[]> {
    const rows = await this.db
      .selectFrom("bookmarks")
      .leftJoin("scraped_url_contents", "scraped_url_contents.bookmark_id", "bookmarks.id")
      .select([
        "bookmarks.id",
        "bookmarks.source_url as sourceUrl",
        "bookmarks.title",
        "bookmarks.cosmic_brief_summary as cosmicBriefSummary",
        "bookmarks.cosmic_summary as cosmicSummary",
        "bookmarks.cosmic_tags as cosmicTags",
        "bookmarks.is_private_link as isPrivateLink",
        "bookmarks.created_at as createdAt",
        "scraped_url_contents.content",
      ])
      .where("bookmarks.user_id", "=", userId)
      .where("bookmarks.is_archived", "=", false)
      .$if(!allowUnprocessed, (qb) => qb.where("bookmarks.processing_status", "=", "completed"))
      .orderBy("bookmarks.created_at", "desc")
      .limit(limit)
      .execute();

    return rows.map((row) => ({ ...row, content: row.content ?? null }));
  }
}
```

- [ ] **Step 4: Export the repository**

Add to `packages/shared/src/repositories/index.ts`:

```ts
export {
  HomeBriefRepository,
  HomeBriefRepositoryImpl,
} from "./home-brief.repository";
export type {
  HomeBriefCardWithSourcesRecord,
  HomeBriefGenerationInput,
  NewHomeBriefCardWithSources,
} from "./home-brief.repository";
```

- [ ] **Step 5: Add ranking tests**

Create `packages/shared/src/__tests__/services/home-brief.ranking.test.ts`:

```ts
import { describe, expect, it } from "@jest/globals";
import { rankHomeBriefCards, selectDisplayCards } from "../../services/home-brief.ranking";
import { HomeBriefCardWithSourcesRecord } from "../../repositories/home-brief.repository";

const card = (id: string, type: "insight" | "quote" | "rediscovery", score: number, bookmarkId: string): HomeBriefCardWithSourcesRecord => ({
  id,
  user_id: "user-1",
  card_type: type,
  title: `${type} title`,
  body: `${type} body`,
  explanation: `${type} explanation`,
  content_hash: id,
  score,
  ranking_reasons: {},
  status: "ready",
  generation_batch_id: "batch-1",
  generated_at: new Date("2026-08-24T12:00:00Z"),
  available_on: "2026-08-24",
  expires_at: null,
  last_shown_at: null,
  dismissed_at: null,
  saved_at: null,
  created_at: new Date("2026-08-24T12:00:00Z"),
  updated_at: new Date("2026-08-24T12:00:00Z"),
  sources: [{ card_id: id, bookmark_id: bookmarkId, source_role: "primary", excerpt: null, title_snapshot: "Source", source_url_snapshot: "https://example.com", created_at: new Date("2026-08-24T12:00:00Z") }],
});

describe("home brief ranking", () => {
  it("keeps cards with higher base scores first", () => {
    const ranked = rankHomeBriefCards([card("low", "quote", 1, "b1"), card("high", "insight", 9, "b2")], { now: new Date("2026-08-24T12:00:00Z") });
    expect(ranked.map((item) => item.id)).toEqual(["high", "low"]);
  });

  it("selects a diverse set of card types and sources", () => {
    const selected = selectDisplayCards([
      card("insight-1", "insight", 10, "b1"),
      card("insight-2", "insight", 9, "b1"),
      card("quote-1", "quote", 8, "b2"),
      card("rediscovery-1", "rediscovery", 7, "b3"),
    ], { limit: 3, now: new Date("2026-08-24T12:00:00Z") });
    expect(selected.map((item) => item.id)).toEqual(["insight-1", "quote-1", "rediscovery-1"]);
  });
});
```

- [ ] **Step 6: Create ranking implementation**

Create `packages/shared/src/services/home-brief.ranking.ts`:

```ts
import { HomeBriefCardWithSourcesRecord } from "../repositories/home-brief.repository";

export interface RankHomeBriefOptions {
  now: Date;
}

export interface SelectDisplayCardsOptions extends RankHomeBriefOptions {
  limit: number;
}

export function rankHomeBriefCards(cards: HomeBriefCardWithSourcesRecord[], _options: RankHomeBriefOptions): HomeBriefCardWithSourcesRecord[] {
  return [...cards].sort((a, b) => Number(b.score) - Number(a.score) || b.generated_at.getTime() - a.generated_at.getTime());
}

export function selectDisplayCards(cards: HomeBriefCardWithSourcesRecord[], options: SelectDisplayCardsOptions): HomeBriefCardWithSourcesRecord[] {
  const ranked = rankHomeBriefCards(cards, options);
  const selected: HomeBriefCardWithSourcesRecord[] = [];
  const usedTypes = new Set<string>();
  const usedSources = new Set<string>();

  for (const card of ranked) {
    const sourceIds = card.sources.map((source) => source.bookmark_id);
    const repeatsSource = sourceIds.some((id) => usedSources.has(id));
    if (selected.length < options.limit && !usedTypes.has(card.card_type) && !repeatsSource) {
      selected.push(card);
      usedTypes.add(card.card_type);
      sourceIds.forEach((id) => usedSources.add(id));
    }
  }

  for (const card of ranked) {
    if (selected.length >= options.limit) break;
    if (selected.some((item) => item.id === card.id)) continue;
    selected.push(card);
  }

  return selected.slice(0, options.limit);
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd packages/shared && bun run test -- home-brief.repository.test.ts home-brief.ranking.test.ts --runInBand
```

Expected: PASS after the migration is applied to the test database.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/repositories/home-brief.repository.ts packages/shared/src/repositories/index.ts packages/shared/src/services/home-brief.ranking.ts packages/shared/src/__tests__/repositories/home-brief.repository.test.ts packages/shared/src/__tests__/services/home-brief.ranking.test.ts
git commit -m "feat(shared): add home brief repository and ranking"
```

---

### Task 3: Add Home Brief Generation

**Files:**
- Create: `packages/shared/src/services/home-brief.prompt.ts`
- Create: `packages/shared/src/services/home-brief.generator.service.ts`
- Create: `packages/shared/src/__tests__/services/home-brief.generator.service.test.ts`
- Modify: `packages/shared/src/services/index.ts`

**Interfaces:**
- Consumes: `HomeBriefRepository.findGenerationInputs`, `AI.generateObject`, processed bookmark summaries, tags, and source content.
- Produces:
  - `HomeBriefGeneratorService.generateForUser(userId: string, options?: { triggerBookmarkId?: string; now?: Date }): Promise<void>`
  - `quoteAppearsInSource(quote: string, source: string): boolean`
  - `extractFallbackQuote(source: string): string | null`

- [ ] **Step 1: Write quote validation and generation tests**

Create `packages/shared/src/__tests__/services/home-brief.generator.service.test.ts`:

```ts
import { describe, expect, it, jest } from "@jest/globals";
import {
  HomeBriefGeneratorServiceImpl,
  quoteAppearsInSource,
  extractFallbackQuote,
} from "../../services/home-brief.generator.service";
import { HomeBriefRepository } from "../../repositories/home-brief.repository";
import { AI } from "../../ai";

describe("home brief generation trust rules", () => {
  it("accepts only exact quote excerpts from source text", () => {
    const source = "The habit becomes durable when the system makes it easy to repeat.";
    expect(quoteAppearsInSource("system makes it easy to repeat", source)).toBe(true);
    expect(quoteAppearsInSource("systems make habits effortless", source)).toBe(false);
  });

  it("extracts a deterministic fallback quote from source text", () => {
    const quote = extractFallbackQuote("Short. This sentence is long enough to become a useful quote for a card. Another sentence.");
    expect(quote).toBe("This sentence is long enough to become a useful quote for a card.");
  });

  it("stores insight, quote, and rediscovery candidates with sources", async () => {
    const repository: jest.Mocked<HomeBriefRepository> = {
      createCards: jest.fn().mockResolvedValue([]),
      findDisplayCards: jest.fn(),
      recordShown: jest.fn(),
      recordFeedback: jest.fn(),
      hasGeneratedSince: jest.fn().mockResolvedValue(false),
      findGenerationInputs: jest.fn().mockResolvedValue([
        { id: "recent-1", sourceUrl: "https://example.com/1", title: "Habits", cosmicBriefSummary: "Systems help habits stick.", cosmicSummary: "Systems help habits stick over time.", cosmicTags: ["habits", "systems"], isPrivateLink: false, createdAt: new Date("2026-08-24"), content: "Systems help habits stick over time. Consistency matters more than intensity." },
        { id: "recent-2", sourceUrl: "https://example.com/2", title: "Practice", cosmicBriefSummary: "Practice improves through repetition.", cosmicSummary: "Practice improves through repetition and feedback.", cosmicTags: ["habits", "practice"], isPrivateLink: false, createdAt: new Date("2026-08-23"), content: "Practice improves through repetition and feedback." },
        { id: "old-1", sourceUrl: "https://example.com/3", title: "Old Note", cosmicBriefSummary: "An older note about systems.", cosmicSummary: "An older note about systems.", cosmicTags: ["systems"], isPrivateLink: false, createdAt: new Date("2026-02-24"), content: "An older note about systems." },
      ]),
      findFallbackBookmarks: jest.fn(),
    };
    const ai = { generateObject: jest.fn().mockResolvedValue({
      insight: { title: "A pattern in your library", body: "Your saved sources suggest that repeated systems matter more than intensity.", explanation: "Selected because two recent saves overlap on habits and systems.", sourceBookmarkIds: ["recent-1", "recent-2"] },
      quote: { title: "Quote worth revisiting", quoteText: "Consistency matters more than intensity.", explanation: "Selected because it captures the strongest practical takeaway.", sourceBookmarkId: "recent-1" },
    }) } as unknown as AI;

    const service = new HomeBriefGeneratorServiceImpl(repository, ai);
    await service.generateForUser("user-1", { now: new Date("2026-08-24T12:00:00Z") });

    expect(repository.createCards).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ card: expect.objectContaining({ card_type: "insight" }) }),
      expect.objectContaining({ card: expect.objectContaining({ card_type: "quote" }) }),
      expect.objectContaining({ card: expect.objectContaining({ card_type: "rediscovery" }) }),
    ]));
  });
});
```

- [ ] **Step 2: Run generator tests to verify failure**

Run:

```bash
cd packages/shared && bun run test -- home-brief.generator.service.test.ts --runInBand
```

Expected: FAIL because the generator service does not exist.

- [ ] **Step 3: Add prompt constants**

Create `packages/shared/src/services/home-brief.prompt.ts`:

```ts
export const HOME_BRIEF_GENERATION_PROMPT = `Create a small home brief from the user's saved content.

Rules:
- Use only the supplied sources.
- Do not invent source titles, URLs, facts, or quotes.
- The insight must use cautious language such as "Your saved sources suggest".
- The quoteText must be copied verbatim from one supplied source content.
- Return sourceBookmarkIds that exist in the supplied source list.

Sources:
{{SOURCES}}`;
```

- [ ] **Step 4: Create generator implementation**

Create `packages/shared/src/services/home-brief.generator.service.ts`:

```ts
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { AI } from "../ai";
import { HomeBriefRepository, HomeBriefGenerationInput, NewHomeBriefCardWithSources } from "../repositories/home-brief.repository";
import { HOME_BRIEF_GENERATION_PROMPT } from "./home-brief.prompt";
import { BOOKMARK_MODEL_IDS } from "./bookmark.model-ids";

const generationSchema = z.object({
  insight: z.object({
    title: z.string(),
    body: z.string(),
    explanation: z.string(),
    sourceBookmarkIds: z.array(z.string()).min(1).max(3),
  }),
  quote: z.object({
    title: z.string(),
    quoteText: z.string(),
    explanation: z.string(),
    sourceBookmarkId: z.string(),
  }),
});

export interface HomeBriefGeneratorService {
  generateForUser(userId: string, options?: { triggerBookmarkId?: string; now?: Date }): Promise<void>;
}

export function quoteAppearsInSource(quote: string, source: string): boolean {
  return source.includes(quote);
}

export function extractFallbackQuote(source: string): string | null {
  const sentences = source.replace(/\s+/g, " ").match(/[^.!?]+[.!?]/g) ?? [];
  const candidate = sentences.map((sentence) => sentence.trim()).find((sentence) => sentence.length >= 60 && sentence.length <= 240);
  return candidate ?? null;
}

export class HomeBriefGeneratorServiceImpl implements HomeBriefGeneratorService {
  constructor(
    private repository: HomeBriefRepository,
    private ai: AI
  ) {}

  async generateForUser(userId: string, options: { triggerBookmarkId?: string; now?: Date } = {}): Promise<void> {
    const now = options.now ?? new Date();
    const recentCutoff = new Date(now);
    recentCutoff.setHours(recentCutoff.getHours() - 18);
    if (await this.repository.hasGeneratedSince(userId, recentCutoff)) return;

    const inputs = await this.repository.findGenerationInputs(userId, 12);
    if (inputs.length === 0) return;

    const batchId = randomUUID();
    const cards: NewHomeBriefCardWithSources[] = [];

    if (inputs.length >= 2) {
      const generated = await this.ai.generateObject({
        sessionID: `home-brief-${batchId}`,
        modelId: BOOKMARK_MODEL_IDS.small,
        prompt: HOME_BRIEF_GENERATION_PROMPT.replace("{{SOURCES}}", this.buildPromptSources(inputs)),
        schema: generationSchema,
      });

      cards.push(this.buildInsightCard(userId, batchId, generated.insight, inputs, now));

      const quoteSource = inputs.find((input) => input.id === generated.quote.sourceBookmarkId);
      if (quoteSource?.content && quoteAppearsInSource(generated.quote.quoteText, quoteSource.content)) {
        cards.push(this.buildQuoteCard(userId, batchId, generated.quote.title, generated.quote.quoteText, generated.quote.explanation, quoteSource, now));
      }
    }

    const fallbackQuoteSource = inputs.find((input) => input.content && !input.isPrivateLink);
    if (!cards.some((card) => card.card.card_type === "quote") && fallbackQuoteSource?.content) {
      const quote = extractFallbackQuote(fallbackQuoteSource.content);
      if (quote) cards.push(this.buildQuoteCard(userId, batchId, "Quote worth revisiting", quote, "Selected from a recently processed saved item.", fallbackQuoteSource, now));
    }

    const rediscovery = this.selectRediscovery(inputs, now);
    if (rediscovery) cards.push(this.buildRediscoveryCard(userId, batchId, rediscovery, inputs, now));

    await this.repository.createCards(cards.slice(0, 3));
  }

  private buildPromptSources(inputs: HomeBriefGenerationInput[]): string {
    return inputs.map((input) => [
      `ID: ${input.id}`,
      `Title: ${input.title ?? "Untitled"}`,
      `URL: ${input.sourceUrl}`,
      `Tags: ${(input.cosmicTags ?? []).join(", ")}`,
      `Summary: ${input.cosmicBriefSummary ?? input.cosmicSummary ?? ""}`,
      `Content: ${(input.content ?? "").replace(/\s+/g, " ").slice(0, 1800)}`,
    ].join("\n")).join("\n\n");
  }

  private buildInsightCard(userId: string, batchId: string, insight: z.infer<typeof generationSchema>["insight"], inputs: HomeBriefGenerationInput[], now: Date): NewHomeBriefCardWithSources {
    const sources = inputs.filter((input) => insight.sourceBookmarkIds.includes(input.id)).slice(0, 3);
    const body = insight.body.startsWith("Your saved sources suggest") ? insight.body : `Your saved sources suggest ${insight.body.charAt(0).toLowerCase()}${insight.body.slice(1)}`;
    return {
      card: this.card(userId, "insight", insight.title, body, insight.explanation, sources, batchId, now, sources.length >= 2 ? 9 : 6),
      sources: sources.map((source, index) => this.source(source, index === 0 ? "primary" : "supporting", null)),
    };
  }

  private buildQuoteCard(userId: string, batchId: string, title: string, quoteText: string, explanation: string, source: HomeBriefGenerationInput, now: Date): NewHomeBriefCardWithSources {
    return {
      card: this.card(userId, "quote", title, quoteText, explanation, [source], batchId, now, quoteText.length >= 60 ? 8 : 6),
      sources: [this.source(source, "quote", quoteText)],
    };
  }

  private buildRediscoveryCard(userId: string, batchId: string, source: HomeBriefGenerationInput, allInputs: HomeBriefGenerationInput[], now: Date): NewHomeBriefCardWithSources {
    const recentTags = new Set(allInputs.slice(0, 5).flatMap((input) => input.cosmicTags ?? []));
    const matchingTags = (source.cosmicTags ?? []).filter((tag) => recentTags.has(tag));
    const reason = matchingTags.length > 0 ? `It connects with recent saves tagged ${matchingTags.slice(0, 2).join(", ")}.` : "It is an older saved item worth revisiting.";
    return {
      card: this.card(userId, "rediscovery", "Worth revisiting", `${source.title ?? "An older saved item"} connects with material in your library.`, reason, [source], batchId, now, 7 + Math.min(matchingTags.length, 2)),
      sources: [this.source(source, "primary", source.cosmicBriefSummary ?? null)],
    };
  }

  private selectRediscovery(inputs: HomeBriefGenerationInput[], now: Date): HomeBriefGenerationInput | null {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    return inputs.find((input) => input.createdAt < cutoff) ?? inputs[inputs.length - 1] ?? null;
  }

  private card(userId: string, type: "insight" | "quote" | "rediscovery", title: string, body: string, explanation: string, sources: HomeBriefGenerationInput[], batchId: string, now: Date, score: number) {
    const contentHash = createHash("sha256").update([type, title, body, sources.map((source) => source.id).sort().join(",")].join("|")).digest("hex");
    return {
      user_id: userId,
      card_type: type,
      title,
      body,
      explanation,
      content_hash: contentHash,
      score,
      ranking_reasons: { quality: score, generatedFrom: sources.length },
      status: "ready" as const,
      generation_batch_id: batchId,
      generated_at: now,
      available_on: now.toISOString().slice(0, 10),
      expires_at: null,
    };
  }

  private source(source: HomeBriefGenerationInput, role: "primary" | "supporting" | "quote", excerpt: string | null) {
    return {
      bookmark_id: source.id,
      source_role: role,
      excerpt,
      title_snapshot: source.title ?? "Untitled",
      source_url_snapshot: source.sourceUrl,
    };
  }
}
```

- [ ] **Step 5: Export generator service**

Add to `packages/shared/src/services/index.ts` exports:

```ts
export * from "./home-brief.ranking";
export * from "./home-brief.prompt";
export * from "./home-brief.generator.service";
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd packages/shared && bun run test -- home-brief.generator.service.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/services/home-brief.prompt.ts packages/shared/src/services/home-brief.generator.service.ts packages/shared/src/services/index.ts packages/shared/src/__tests__/services/home-brief.generator.service.test.ts
git commit -m "feat(shared): generate source-backed home brief cards"
```

---

### Task 4: Add API-Facing Home Brief Service

**Files:**
- Create: `packages/shared/src/services/home-brief.service.ts`
- Create: `packages/shared/src/__tests__/services/home-brief.service.test.ts`
- Modify: `packages/shared/src/services/index.ts`

**Interfaces:**
- Consumes: `HomeBriefRepository`, `selectDisplayCards`, fallback bookmarks.
- Produces:
  - `HomeBriefService.getBrief(userId: string, options?: { limit?: number; now?: Date }): Promise<GetHomeBriefResponse>`
  - `HomeBriefService.submitFeedback(userId: string, cardId: string, action: HomeBriefFeedbackAction): Promise<HomeBriefFeedbackResponse>`

- [ ] **Step 1: Write service tests**

Create `packages/shared/src/__tests__/services/home-brief.service.test.ts`:

```ts
import { describe, expect, it, jest } from "@jest/globals";
import { HomeBriefServiceImpl } from "../../services/home-brief.service";
import { HomeBriefRepository } from "../../repositories/home-brief.repository";

describe("HomeBriefService", () => {
  it("returns deterministic no-content fallback when the library is empty", async () => {
    const repository = mockRepository();
    repository.findDisplayCards.mockResolvedValue([]);
    repository.findFallbackBookmarks.mockResolvedValue([]);
    const service = new HomeBriefServiceImpl(repository);

    const response = await service.getBrief("user-1", { now: new Date("2026-08-24T12:00:00Z") });

    expect(response.cards).toEqual([]);
    expect(response.fallbackReason).toBe("no_content");
  });

  it("records shown timestamps for returned persisted cards", async () => {
    const repository = mockRepository();
    repository.findDisplayCards.mockResolvedValue([{ ...persistedCard("card-1"), sources: [source("card-1")] }]);
    const service = new HomeBriefServiceImpl(repository);

    const response = await service.getBrief("user-1", { now: new Date("2026-08-24T12:00:00Z") });

    expect(response.cards[0].id).toBe("card-1");
    expect(repository.recordShown).toHaveBeenCalledWith("user-1", ["card-1"], new Date("2026-08-24T12:00:00Z"));
  });

  it("persists deterministic fallback cards so feedback still works", async () => {
    const repository = mockRepository();
    repository.findDisplayCards.mockResolvedValue([]);
    repository.findFallbackBookmarks.mockResolvedValue([{
      id: "bookmark-1",
      sourceUrl: "https://example.com/source",
      title: "Systems Article",
      cosmicBriefSummary: "A practical note about systems.",
      cosmicSummary: "A practical note about systems.",
      cosmicTags: ["systems"],
      isPrivateLink: false,
      createdAt: new Date("2026-08-20T12:00:00Z"),
      content: "A practical note about systems.",
    }]);
    repository.createCards.mockResolvedValue([{ ...persistedCard("fallback-card-1"), card_type: "rediscovery", sources: [source("fallback-card-1")] }]);
    const service = new HomeBriefServiceImpl(repository);

    const response = await service.getBrief("user-1", { now: new Date("2026-08-24T12:00:00Z") });

    expect(response.cards[0].id).toBe("fallback-card-1");
    expect(response.fallbackReason).toBe("low_content");
    expect(repository.createCards).toHaveBeenCalled();
    expect(repository.recordShown).toHaveBeenCalledWith("user-1", ["fallback-card-1"], new Date("2026-08-24T12:00:00Z"));
  });

  it("dismisses cards through feedback", async () => {
    const repository = mockRepository();
    repository.recordFeedback.mockResolvedValue({ ...persistedCard("card-1"), status: "dismissed", sources: [source("card-1")] });
    const service = new HomeBriefServiceImpl(repository);

    const response = await service.submitFeedback("user-1", "card-1", "dismiss");

    expect(response.card.id).toBe("card-1");
    expect(repository.recordFeedback).toHaveBeenCalledWith("user-1", "card-1", "dismiss");
  });
});

function mockRepository(): jest.Mocked<HomeBriefRepository> {
  return {
    createCards: jest.fn(),
    findDisplayCards: jest.fn(),
    recordShown: jest.fn(),
    recordFeedback: jest.fn(),
    hasGeneratedSince: jest.fn(),
    findGenerationInputs: jest.fn(),
    findFallbackBookmarks: jest.fn(),
  };
}

function persistedCard(id: string) {
  return {
    id,
    user_id: "user-1",
    card_type: "insight" as const,
    title: "Today in your library",
    body: "Your saved sources suggest steady systems matter.",
    explanation: "Selected from two saved items.",
    content_hash: id,
    score: 9,
    ranking_reasons: {},
    status: "ready" as const,
    generation_batch_id: "batch-1",
    generated_at: new Date("2026-08-24T12:00:00Z"),
    available_on: "2026-08-24",
    expires_at: null,
    last_shown_at: null,
    dismissed_at: null,
    saved_at: null,
    created_at: new Date("2026-08-24T12:00:00Z"),
    updated_at: new Date("2026-08-24T12:00:00Z"),
  };
}

function source(cardId: string) {
  return {
    card_id: cardId,
    bookmark_id: "bookmark-1",
    source_role: "primary" as const,
    excerpt: null,
    title_snapshot: "Source title",
    source_url_snapshot: "https://example.com/source",
    created_at: new Date("2026-08-24T12:00:00Z"),
  };
}
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
cd packages/shared && bun run test -- home-brief.service.test.ts --runInBand
```

Expected: FAIL because `HomeBriefServiceImpl` does not exist.

- [ ] **Step 3: Implement service mapping and fallback**

Create `packages/shared/src/services/home-brief.service.ts`:

```ts
import {
  GetHomeBriefResponse,
  HomeBriefCard,
  HomeBriefFeedbackAction,
  HomeBriefFeedbackResponse,
} from "../types";
import {
  HomeBriefCardWithSourcesRecord,
  HomeBriefGenerationInput,
  HomeBriefRepository,
  NewHomeBriefCardWithSources,
} from "../repositories/home-brief.repository";
import { selectDisplayCards } from "./home-brief.ranking";
import { createHash, randomUUID } from "crypto";

export interface HomeBriefService {
  getBrief(userId: string, options?: { limit?: number; now?: Date; cooldownDays?: number }): Promise<GetHomeBriefResponse>;
  submitFeedback(userId: string, cardId: string, action: HomeBriefFeedbackAction): Promise<HomeBriefFeedbackResponse>;
}

export class HomeBriefServiceImpl implements HomeBriefService {
  constructor(private repository: HomeBriefRepository) {}

  async getBrief(userId: string, options: { limit?: number; now?: Date; cooldownDays?: number } = {}): Promise<GetHomeBriefResponse> {
    const limit = options.limit ?? 3;
    const now = options.now ?? new Date();
    const cooldownDays = options.cooldownDays ?? 7;
    const candidates = await this.repository.findDisplayCards(userId, { limit: limit * 4, cooldownDays, now });
    const selected = selectDisplayCards(candidates, { limit, now });

    if (selected.length > 0) {
      await this.repository.recordShown(userId, selected.map((card) => card.id), now);
      return { cards: selected.map(mapCard) };
    }

    const fallbackBookmarks = await this.repository.findFallbackBookmarks(userId, limit);
    if (fallbackBookmarks.length === 0) return { cards: [], fallbackReason: "no_content" };

    const fallbackReason = fallbackBookmarks.length < 3 ? "low_content" : "generation_unavailable";
    const persistedFallbacks = await this.repository.createCards(
      fallbackBookmarks.map((bookmark, index) => fallbackCardInput(userId, bookmark, index, now))
    );
    const fallbackCards = selectDisplayCards(persistedFallbacks, { limit, now });
    await this.repository.recordShown(userId, fallbackCards.map((card) => card.id), now);

    return {
      cards: fallbackCards.map(mapCard),
      fallbackReason,
    };
  }

  async submitFeedback(userId: string, cardId: string, action: HomeBriefFeedbackAction): Promise<HomeBriefFeedbackResponse> {
    const card = await this.repository.recordFeedback(userId, cardId, action);
    if (!card) {
      throw new Error("Home brief card not found");
    }
    return { card: mapCard(card) };
  }
}

export function mapCard(card: HomeBriefCardWithSourcesRecord): HomeBriefCard {
  return {
    id: card.id,
    type: card.card_type,
    title: card.title,
    body: card.body,
    explanation: card.explanation,
    savedAt: card.saved_at ?? undefined,
    generatedAt: card.generated_at,
    sources: card.sources.map((source) => ({
      bookmarkId: source.bookmark_id,
      title: source.title_snapshot,
      sourceUrl: source.source_url_snapshot,
      role: source.source_role,
      excerpt: source.excerpt ?? undefined,
    })),
  };
}

function fallbackCardInput(userId: string, bookmark: HomeBriefGenerationInput, index: number, now: Date): NewHomeBriefCardWithSources {
  const title = index === 0 ? "Worth opening again" : "From your library";
  const body = bookmark.cosmicBriefSummary || bookmark.cosmicSummary || bookmark.title || bookmark.sourceUrl;
  const contentHash = createHash("sha256").update(["fallback", bookmark.id, title, body].join("|")).digest("hex");
  return {
    card: {
      user_id: userId,
      card_type: index === 0 ? "rediscovery" : "quote",
      title,
      body,
      explanation: "Selected from your saved content while your personalized brief is still warming up.",
      content_hash: contentHash,
      score: 5 - index,
      ranking_reasons: { fallback: true },
      status: "ready",
      generation_batch_id: randomUUID(),
      generated_at: now,
      available_on: now.toISOString().slice(0, 10),
      expires_at: null,
    },
    sources: [{
      bookmark_id: bookmark.id,
      title_snapshot: bookmark.title ?? "Untitled",
      source_url_snapshot: bookmark.sourceUrl,
      source_role: "primary",
      excerpt: bookmark.cosmicBriefSummary ?? null,
    }],
  };
}
```

- [ ] **Step 4: Wire service container**

Modify `packages/shared/src/services/index.ts`:

```ts
export * from "./home-brief.service";
```

Add imports:

```ts
import { HomeBriefRepositoryImpl } from "../repositories";
import { HomeBriefService, HomeBriefServiceImpl } from "./home-brief.service";
```

Add to `ServiceContainer`:

```ts
homeBrief: HomeBriefService;
```

Add to `createServiceContainer`:

```ts
const homeBriefRepository = new HomeBriefRepositoryImpl(db);
```

Add to returned object:

```ts
homeBrief: new HomeBriefServiceImpl(homeBriefRepository),
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd packages/shared && bun run test -- home-brief.service.test.ts --runInBand
cd packages/shared && bun run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/home-brief.service.ts packages/shared/src/services/index.ts packages/shared/src/__tests__/services/home-brief.service.test.ts
git commit -m "feat(shared): add home brief service"
```

---

### Task 5: Add API Contract And Routes

**Files:**
- Create: `packages/apispec/home-brief.tsp`
- Modify: `packages/apispec/main.tsp`
- Create: `apps/api/src/routes/home-brief.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/tests/home-brief.test.ts`

**Interfaces:**
- Consumes: `HomeBriefService.getBrief`, `HomeBriefService.submitFeedback`.
- Produces:
  - `GET /api/v1/home-brief?limit=3`
  - `POST /api/v1/home-brief/{id}/feedback`
  - Generated client class `HomeBriefApi`

- [ ] **Step 1: Add API validation tests**

Create `apps/api/src/tests/home-brief.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { validateHomeBriefFeedbackBody, validateHomeBriefLimit } from "../routes/home-brief";

describe("home brief route validation", () => {
  it("accepts valid feedback actions", () => {
    expect(validateHomeBriefFeedbackBody({ action: "useful" })).toEqual({ ok: true });
    expect(validateHomeBriefFeedbackBody({ action: "save_insight" })).toEqual({ ok: true });
  });

  it("rejects unknown feedback actions", () => {
    expect(validateHomeBriefFeedbackBody({ action: "share" })).toEqual({
      ok: false,
      status: 400,
      error: "Unsupported feedback action",
    });
  });

  it("keeps the brief limit between one and three", () => {
    expect(validateHomeBriefLimit(0)).toBe(1);
    expect(validateHomeBriefLimit(2)).toBe(2);
    expect(validateHomeBriefLimit(10)).toBe(3);
  });
});
```

- [ ] **Step 2: Run API tests to verify failure**

Run:

```bash
cd apps/api && bun run test -- --testPathPattern=home-brief.test.ts
```

Expected: FAIL because `routes/home-brief` does not exist.

- [ ] **Step 3: Add TypeSpec contract**

Create `packages/apispec/home-brief.tsp`:

```tsp
import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;
namespace CosmicDolphinService;

enum HomeBriefCardType {
    insight,
    quote,
    rediscovery,
}

enum HomeBriefFeedbackAction {
    useful,
    not_useful,
    show_less_like_this,
    dismiss,
    save_insight,
}

enum HomeBriefFallbackReason {
    no_content,
    low_content,
    generation_unavailable,
}

model HomeBriefCardSource {
    bookmarkId: string;
    title: string;
    sourceUrl: string;
    role: string;
    excerpt?: string;
}

model HomeBriefCard {
    id: string;
    type: HomeBriefCardType;
    title: string;
    body: string;
    explanation: string;
    sources: HomeBriefCardSource[];
    savedAt?: utcDateTime;
    generatedAt: utcDateTime;
}

model GetHomeBriefQuery {
    @query
    limit?: int32 = 3;
}

model GetHomeBriefResponse {
    cards: HomeBriefCard[];
    fallbackReason?: HomeBriefFallbackReason;
}

model HomeBriefFeedbackRequest {
    action: HomeBriefFeedbackAction;
}

model HomeBriefFeedbackResponse {
    card: HomeBriefCard;
}

model HomeBriefError {
    error: string;
}

@route("/home-brief")
@tag("HomeBrief")
interface HomeBrief {
    @doc("Get persisted home brief cards for the signed-in user")
    @useAuth(BearerAuth)
    @get
    list(...GetHomeBriefQuery): GetHomeBriefResponse | {
        @statusCode statusCode: 500;
        @body body: HomeBriefError;
    };

    @doc("Record feedback for a home brief card")
    @useAuth(BearerAuth)
    @post
    @route("/{id}/feedback")
    feedback(@path id: string, @body request: HomeBriefFeedbackRequest):
        | HomeBriefFeedbackResponse
        | {
              @statusCode statusCode: 400;
              @body body: HomeBriefError;
          }
        | {
              @statusCode statusCode: 404;
              @body body: HomeBriefError;
          }
        | {
              @statusCode statusCode: 500;
              @body body: HomeBriefError;
          };
}
```

Add to `packages/apispec/main.tsp`:

```tsp
import "./home-brief.tsp";
```

- [ ] **Step 4: Implement Fastify route**

Create `apps/api/src/routes/home-brief.ts`:

```ts
import { FastifyInstance } from "fastify";
import {
  HomeBriefFeedbackAction,
  HomeBriefFeedbackRequest,
  createDatabase,
  createServiceContainer,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

const actions: HomeBriefFeedbackAction[] = ["useful", "not_useful", "show_less_like_this", "dismiss", "save_insight"];

export function validateHomeBriefLimit(limit: unknown): number {
  const parsed = typeof limit === "number" ? limit : Number(limit ?? 3);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(3, Math.max(1, Math.trunc(parsed)));
}

export function validateHomeBriefFeedbackBody(body: Partial<HomeBriefFeedbackRequest>):
  | { ok: true }
  | { ok: false; status: 400; error: string } {
  return body.action && actions.includes(body.action) ? { ok: true } : { ok: false, status: 400, error: "Unsupported feedback action" };
}

export default async function homeBriefRoutes(fastify: FastifyInstance) {
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  const db = createDatabase(config.DATABASE_URL);
  const services = createServiceContainer(supabase, db);

  fastify.get<{ Querystring: { limit?: number } }>("/home-brief", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = request.userId!;
      const limit = validateHomeBriefLimit(request.query.limit);
      return reply.send(await services.homeBrief.getBrief(userId, { limit }));
    } catch (error) {
      fastify.log.error({ error }, "Get home brief error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.post<{ Params: { id: string }; Body: HomeBriefFeedbackRequest }>("/home-brief/:id/feedback", { preHandler: authMiddleware }, async (request, reply) => {
    const validation = validateHomeBriefFeedbackBody(request.body);
    if (!validation.ok) return reply.status(validation.status).send({ error: validation.error });

    try {
      const userId = request.userId!;
      return reply.send(await services.homeBrief.submitFeedback(userId, request.params.id, request.body.action));
    } catch (error) {
      if (error instanceof Error && error.message === "Home brief card not found") {
        return reply.status(404).send({ error: "Home brief card not found" });
      }
      fastify.log.error({ error }, "Home brief feedback error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
```

Modify `apps/api/src/index.ts`:

```ts
import homeBriefRoutes from "./routes/home-brief";
```

Register with the existing routes:

```ts
await fastify.register(homeBriefRoutes, { prefix: "/api/v1" });
```

- [ ] **Step 5: Regenerate the API client**

Run:

```bash
bun run apispec
```

Expected: TypeSpec compiles, `packages/api-client` regenerates, and the generated client builds.

- [ ] **Step 6: Run API tests and build**

Run:

```bash
cd apps/api && bun run test -- --testPathPattern=home-brief.test.ts
cd apps/api && bun run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/apispec/home-brief.tsp packages/apispec/main.tsp packages/api-client apps/api/src/routes/home-brief.ts apps/api/src/index.ts apps/api/src/tests/home-brief.test.ts
git commit -m "feat(api): expose home brief endpoints"
```

---

### Task 6: Trigger Generation From The Worker

**Files:**
- Modify: `apps/worker/src/queue/tokens.ts`
- Modify: `apps/worker/src/queue/queue.module.ts`
- Modify: `apps/worker/src/queue/handlers/bookmark-processor.handler.ts`
- Create: `apps/worker/src/queue/handlers/bookmark-processor.handler.spec.ts`

**Interfaces:**
- Consumes: `HomeBriefGeneratorService.generateForUser`.
- Produces: non-blocking generation call after `BookmarkProcessorService.process`.

- [ ] **Step 1: Add worker handler tests**

Create `apps/worker/src/queue/handlers/bookmark-processor.handler.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { BookmarkProcessorHandler } from "./bookmark-processor.handler";
import { BOOKMARK_PROCESSOR_SERVICE, HOME_BRIEF_GENERATOR_SERVICE } from "../tokens";

describe("BookmarkProcessorHandler", () => {
  it("generates the home brief after bookmark processing succeeds", async () => {
    const bookmarkProcessorService = { process: jest.fn().mockResolvedValue(undefined) };
    const homeBriefGenerator = { generateForUser: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        BookmarkProcessorHandler,
        { provide: BOOKMARK_PROCESSOR_SERVICE, useValue: bookmarkProcessorService },
        { provide: HOME_BRIEF_GENERATOR_SERVICE, useValue: homeBriefGenerator },
      ],
    }).compile();

    const handler = module.get(BookmarkProcessorHandler);
    await handler.handle({ msg_id: 1, read_ct: 1, enqueued_at: new Date(), vt: new Date(), message: { type: "bookmark_process", data: { bookmarkId: "bookmark-1", userId: "user-1" } } });

    expect(bookmarkProcessorService.process).toHaveBeenCalledWith("bookmark-1", "user-1");
    expect(homeBriefGenerator.generateForUser).toHaveBeenCalledWith("user-1", { triggerBookmarkId: "bookmark-1" });
  });

  it("does not fail bookmark processing when home brief generation fails", async () => {
    const bookmarkProcessorService = { process: jest.fn().mockResolvedValue(undefined) };
    const homeBriefGenerator = { generateForUser: jest.fn().mockRejectedValue(new Error("brief failed")) };
    const module = await Test.createTestingModule({
      providers: [
        BookmarkProcessorHandler,
        { provide: BOOKMARK_PROCESSOR_SERVICE, useValue: bookmarkProcessorService },
        { provide: HOME_BRIEF_GENERATOR_SERVICE, useValue: homeBriefGenerator },
      ],
    }).compile();

    const handler = module.get(BookmarkProcessorHandler);
    await expect(handler.handle({ msg_id: 1, read_ct: 1, enqueued_at: new Date(), vt: new Date(), message: { type: "bookmark_process", data: { bookmarkId: "bookmark-1", userId: "user-1" } } })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Enable worker tests**

Modify `apps/worker/package.json`:

```json
"test": "jest"
```

Run:

```bash
cd apps/worker && bun run test -- bookmark-processor.handler.spec.ts --runInBand
```

Expected: FAIL because the handler does not inject or call the home brief generator.

- [ ] **Step 3: Add the injection token**

Add to `apps/worker/src/queue/tokens.ts`:

```ts
export const HOME_BRIEF_GENERATOR_SERVICE = Symbol("HOME_BRIEF_GENERATOR_SERVICE");
```

- [ ] **Step 4: Wire the generator provider**

Modify imports in `apps/worker/src/queue/queue.module.ts`:

```ts
HomeBriefGeneratorServiceImpl,
HomeBriefRepositoryImpl,
```

Add provider:

```ts
{
  provide: HOME_BRIEF_GENERATOR_SERVICE,
  useFactory: (db: Kysely<Database>, ai: AI) => {
    const homeBriefRepository = new HomeBriefRepositoryImpl(db);
    return new HomeBriefGeneratorServiceImpl(homeBriefRepository, ai);
  },
  inject: [DATABASE_INSTANCE, AI],
},
```

- [ ] **Step 5: Trigger generation after processing**

Modify `apps/worker/src/queue/handlers/bookmark-processor.handler.ts` constructor:

```ts
constructor(
  @Inject(BOOKMARK_PROCESSOR_SERVICE)
  private readonly bookmarkProcessorService: BookmarkProcessorService,
  @Inject(HOME_BRIEF_GENERATOR_SERVICE)
  private readonly homeBriefGeneratorService: HomeBriefGeneratorService,
) {}
```

After `await this.bookmarkProcessorService.process(bookmarkId, userId);` add:

```ts
try {
  await this.homeBriefGeneratorService.generateForUser(userId, { triggerBookmarkId: bookmarkId });
} catch (error) {
  this.logger.warn("Home brief generation failed after bookmark processing", {
    bookmarkId,
    userId,
    error: error instanceof Error ? error.message : error,
  });
}
```

- [ ] **Step 6: Run worker tests and build**

Run:

```bash
cd apps/worker && bun run test -- bookmark-processor.handler.spec.ts --runInBand
cd apps/worker && bun run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/queue/tokens.ts apps/worker/src/queue/queue.module.ts apps/worker/src/queue/handlers/bookmark-processor.handler.ts apps/worker/src/queue/handlers/bookmark-processor.handler.spec.ts apps/worker/package.json
git commit -m "feat(worker): refresh home brief after bookmark processing"
```

---

### Task 7: Build Web Client And Dashboard UI

**Files:**
- Create: `apps/web/lib/api/home-brief.ts`
- Create: `apps/web/lib/api/home-brief-client.ts`
- Create: `apps/web/components/home-brief/HomeBriefSection.tsx`
- Create: `apps/web/components/home-brief/home-brief-card.test.tsx`
- Modify: `apps/web/app/(private)/my/dashboard/page.tsx`

**Interfaces:**
- Consumes: generated `HomeBriefApi`, `HomeBriefCard`, `HomeBriefFeedbackAction`.
- Produces:
  - `HomeBriefAPI.get()`
  - `HomeBriefClientAPI.feedback(cardId, action)`
  - `HomeBriefSection({ cards, fallbackReason })`

- [ ] **Step 1: Add web rendering tests**

Create `apps/web/components/home-brief/home-brief-card.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeBriefSection } from "./HomeBriefSection";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe("HomeBriefSection", () => {
  it("renders card copy with source links", () => {
    const markup = renderToStaticMarkup(
      <HomeBriefSection
        cards={[{
          id: "card-1",
          type: "quote",
          title: "Quote worth revisiting",
          body: "Consistency matters more than intensity.",
          explanation: "Selected because it captures a repeated idea.",
          generatedAt: new Date("2026-08-24T12:00:00Z"),
          sources: [{ bookmarkId: "bookmark-1", title: "Systems Article", sourceUrl: "https://example.com/source", role: "quote", excerpt: "Consistency matters more than intensity." }],
        }]}
      />
    );

    expect(markup).toContain("From Your Library");
    expect(markup).toContain("Quote worth revisiting");
    expect(markup).toContain("Consistency matters more than intensity.");
    expect(markup).toContain("Systems Article");
    expect(markup).toContain('href="/bookmarks/bookmark-1"');
  });

  it("renders the no-content state", () => {
    const markup = renderToStaticMarkup(<HomeBriefSection cards={[]} fallbackReason="no_content" />);

    expect(markup).toContain("Save a few articles, notes, or links");
  });
});
```

- [ ] **Step 2: Run web tests to verify failure**

Run:

```bash
cd apps/web && bun run test -- components/home-brief/home-brief-card.test.tsx
```

Expected: FAIL because `HomeBriefSection` does not exist.

- [ ] **Step 3: Add server API client**

Create `apps/web/lib/api/home-brief.ts`:

```ts
import { Configuration, HomeBriefApi, GetHomeBriefResponse } from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/server";

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) throw new Error("NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables.");
  return basePath;
}

export namespace HomeBriefAPI {
  async function getApiInstance(): Promise<HomeBriefApi> {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return new HomeBriefApi(new Configuration({ basePath: getApiBasePath(), accessToken: session?.access_token || "" }));
  }

  export async function get(limit = 3): Promise<GetHomeBriefResponse> {
    const api = await getApiInstance();
    try {
      return await api.homeBriefList({ limit });
    } catch (error) {
      console.error("Error fetching home brief", error);
      return { cards: [], fallbackReason: "generation_unavailable" };
    }
  }
}
```

- [ ] **Step 4: Add browser API client**

Create `apps/web/lib/api/home-brief-client.ts`:

```ts
import { Configuration, HomeBriefApi, HomeBriefFeedbackAction, HomeBriefFeedbackResponse } from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/client";

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) throw new Error("NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables.");
  return basePath;
}

async function getApiInstance(): Promise<HomeBriefApi> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return new HomeBriefApi(new Configuration({ basePath: getApiBasePath(), accessToken: session?.access_token || "" }));
}

export namespace HomeBriefClientAPI {
  export async function feedback(cardId: string, action: HomeBriefFeedbackAction): Promise<HomeBriefFeedbackResponse> {
    const api = await getApiInstance();
    return api.homeBriefFeedback({ id: cardId, homeBriefFeedbackRequest: { action } });
  }
}
```

- [ ] **Step 5: Create the UI component**

Create `apps/web/components/home-brief/HomeBriefSection.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, ExternalLink, Lightbulb, MessageSquareQuote, RefreshCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import type { GetHomeBriefResponse, HomeBriefCard, HomeBriefFeedbackAction } from "@cosmic-dolphin/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HomeBriefClientAPI } from "@/lib/api/home-brief-client";

type Props = GetHomeBriefResponse;

const cardIcon = {
  insight: Lightbulb,
  quote: MessageSquareQuote,
  rediscovery: RefreshCcw,
} as const;

export function HomeBriefSection({ cards, fallbackReason }: Props) {
  const [visibleCards, setVisibleCards] = useState(cards);

  if (visibleCards.length === 0) {
    return (
      <section className="w-full py-10">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center dark:border-gray-700 dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-gray-950 dark:text-gray-50">From Your Library</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
            Save a few articles, notes, or links and Cosmic Dolphin will turn them into a personalized brief.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-gray-950 dark:text-gray-50">From Your Library</h1>
          {fallbackReason && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Showing saved items while your brief refreshes.</p>
          )}
        </div>
      </div>
      <div className="grid gap-3">
        {visibleCards.map((card) => (
          <BriefCard
            key={card.id}
            card={card}
            onHidden={(id) => setVisibleCards((current) => current.filter((item) => item.id !== id))}
          />
        ))}
      </div>
    </section>
  );
}

function BriefCard({ card, onHidden }: { card: HomeBriefCard; onHidden: (id: string) => void }) {
  const Icon = cardIcon[card.type];

  async function react(action: HomeBriefFeedbackAction) {
    await HomeBriefClientAPI.feedback(card.id, action);
    if (action === "dismiss" || action === "show_less_like_this") onHidden(card.id);
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">{card.type}</Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400">{card.sources.length} source{card.sources.length === 1 ? "" : "s"}</span>
          </div>
          <h2 className="text-base font-semibold leading-snug text-gray-950 dark:text-gray-50">{card.title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">{card.type === "quote" ? `"${card.body}"` : card.body}</p>
          <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{card.explanation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {card.sources.map((source) => (
              <Button key={`${card.id}-${source.bookmarkId}-${source.role}`} asChild variant="outline" size="sm">
                <Link href={`/bookmarks/${source.bookmarkId}`}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  {source.title}
                </Link>
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => react("useful")}><ThumbsUp className="mr-2 h-3.5 w-3.5" />Useful</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => react("not_useful")}><ThumbsDown className="mr-2 h-3.5 w-3.5" />Not useful</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => react("show_less_like_this")}>Show less like this</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => react("save_insight")}><Bookmark className="mr-2 h-3.5 w-3.5" />Save insight</Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Dismiss card" onClick={() => react("dismiss")}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Render on dashboard**

Modify `apps/web/app/(private)/my/dashboard/page.tsx`:

```tsx
import { HomeBriefSection } from "@/components/home-brief/HomeBriefSection";
import { HomeBriefAPI } from "@/lib/api/home-brief";

export default async function Index() {
  const brief = await HomeBriefAPI.get(3);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <HomeBriefSection cards={brief.cards} fallbackReason={brief.fallbackReason} />
    </main>
  );
}
```

- [ ] **Step 7: Run web tests and checks**

Run:

```bash
cd apps/web && bun run test -- components/home-brief/home-brief-card.test.tsx
cd apps/web && bun run typecheck
cd apps/web && bun run lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/api/home-brief.ts apps/web/lib/api/home-brief-client.ts apps/web/components/home-brief/HomeBriefSection.tsx apps/web/components/home-brief/home-brief-card.test.tsx 'apps/web/app/(private)/my/dashboard/page.tsx'
git commit -m "feat(web): show source-backed home brief cards"
```

---

### Task 8: End-To-End Verification And Acceptance Sweep

**Files:**
- Verify: `docs/superpowers/specs/2026-08-24-smart-home-brief-design.md`
- Verify: all files changed in Tasks 1-7

**Interfaces:**
- Consumes: completed DB, shared, API, worker, and web changes.
- Produces: a verified branch ready for review.

- [ ] **Step 1: Apply migrations to the test database**

Run:

```bash
bun run db:migrate:test
```

Expected: the new home brief tables exist in the linked test Supabase project.

- [ ] **Step 2: Regenerate the API client**

Run:

```bash
bun run apispec
```

Expected: TypeSpec, OpenAPI generation, and `packages/api-client` build all pass.

- [ ] **Step 3: Run backend tests**

Run:

```bash
bun run test:backend
```

Expected: shared, API, and worker tests pass.

- [ ] **Step 4: Run web tests and static checks**

Run:

```bash
cd apps/web && bun run test
cd apps/web && bun run typecheck
cd apps/web && bun run lint
```

Expected: PASS.

- [ ] **Step 5: Run full build**

Run:

```bash
bun run build
```

Expected: all packages and apps build.

- [ ] **Step 6: Manually verify the MVP paths**

Run the stack:

```bash
bun run dev:fullstack
```

Verify:

- A signed-in user with no bookmarks sees the no-content `From Your Library` state.
- A signed-in user with one processed bookmark sees deterministic fallback content with a source link.
- A signed-in user with several processed bookmarks sees up to three cards.
- A quote card displays text that is present in the saved source content.
- Every source button opens `/bookmarks/{bookmarkId}`.
- Clicking `Dismiss` removes the card immediately and keeps it hidden after refresh.
- Clicking `Useful`, `Not useful`, `Show less like this`, and `Save insight` returns a 200 response.
- Deleting a bookmark used by a card removes or expires that card from future brief responses.
- Reloading `/my/dashboard` does not trigger an AI network request from the web app.

- [ ] **Step 7: Commit verification fixes**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: harden smart home brief MVP"
```

- [ ] **Step 8: Final review checklist**

Confirm these acceptance criteria against the implementation:

- [ ] Up to three personalized cards render on the signed-in dashboard.
- [ ] Cards are derived only from the user's bookmarks.
- [ ] One insight appears when at least two processed bookmarks are available.
- [ ] Quote card text exactly matches source content.
- [ ] All cards include source links.
- [ ] Cooldown prevents immediate repeat display.
- [ ] The dashboard reads persisted data and does not perform live AI generation.
- [ ] Deterministic fallback covers no-content, low-content, and generation-unavailable cases.
- [ ] Feedback and dismiss actions persist.
- [ ] Deleted source bookmarks expire affected cards.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/specs/2026-08-24-smart-home-brief-design.md docs/superpowers/plans/2026-08-24-smart-home-brief.md
git commit -m "docs: plan smart home brief"
```
