/**
 * Save summary quality, serial backend integration (spec §8.10). Real database,
 * repositories, processor and HTTP routes; a seeded extraction at the `scrape`
 * boundary and a deterministic model. Synthetic sources only.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";
import Fastify, { type FastifyInstance } from "fastify";
import { sql } from "kysely";
import { NoObjectGeneratedError } from "ai";
import {
  BookmarkProcessingRepositoryImpl,
  BookmarkProcessorServiceImpl,
  BookmarkRepositoryImpl,
  BookmarkServiceImpl,
  CollectionRepositoryImpl,
  ContentChunkRepositoryImpl,
  WebScrapingServiceImpl,
  type AI,
  type ServiceContainer,
  type WebScrapingService,
} from "@cosmic-dolphin/shared";
import { DatabaseTestUtils, closeTestDatabase, getTestDatabase } from "@cosmic-dolphin/shared/dist/test-utils/database";
import { registerBookmarkRoutes } from "../routes/bookmarks";

type Extracted = Awaited<ReturnType<WebScrapingService["scrape"]>>;
const db = getTestDatabase();
const utils = new DatabaseTestUtils(db);
const repository = new BookmarkRepositoryImpl(db);
const sources = new Map<string, () => Extracted | Promise<Extracted>>();
const scraping = Object.assign(Object.create(new WebScrapingServiceImpl()), {
  scrape: async (url: string) => {
    const source = sources.get(url);
    if (!source) throw new Error(`No seeded source for ${url}`);
    return structuredClone(await source());
  },
}) as WebScrapingService;
const bookmark = new BookmarkServiceImpl(repository, scraping);
const X = "X (formerly Twitter)";
const POST_URL = "https://x.com/ann/status/101";
const ARTICLE_URL = "https://essay.example.org/on-bottlenecks";
let app: FastifyInstance;
let address: string;
let owner: string;

beforeAll(async () => {
  await utils.waitForConnection();
  app = Fastify();
  await registerBookmarkRoutes(app, { bookmark, feed: { recordOpen: async () => {} } } as unknown as ServiceContainer,
    async (request) => { request.userId = request.headers["x-fixture-owner"] as string; });
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});
beforeEach(async () => {
  await utils.truncateAll();
  sources.clear();
  owner = crypto.randomUUID();
});
afterAll(async () => { await app?.close(); await closeTestDatabase(); });

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(address + path, { method, headers: { "x-fixture-owner": owner, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as any };
}

const postBlock = `<blockquote>\n<p><strong>Ann</strong> @ann · <time>2026-11-22</time></p>\n<p>Imprint ships four times faster and POSTONLYTERM incidents fell.</p>\n<p><a href="${ARTICLE_URL}">${ARTICLE_URL}</a></p>\n</blockquote>`;
function xRow(article: string | null, status: "complete" | "failed" = "complete"): Extracted {
  return {
    title: "Tweet by Ann (@ann)",
    content: article === null ? postBlock : `${postBlock}\n<article>\n${article}\n</article>`,
    images: [{ url: "https://pbs.example/chart.jpg", alt: "Throughput chart" }],
    links: [{ url: ARTICLE_URL, text: ARTICLE_URL }, ...(article ? [{ url: "https://essay.example.org/about", text: "About" }] : [])],
    metadata: {
      openGraph: { title: "Tweet by Ann (@ann)", description: "Imprint ships four times faster", site_name: X, image: "https://pbs.example/chart.jpg", url: POST_URL },
      wordCount: 400,
      readingTime: 2,
      extraction: {
        status: "complete",
        provider: "fxtwitter",
        linked: status === "complete" ? { url: ARTICLE_URL, status, title: "On bottlenecks" } : { url: ARTICLE_URL, status, error: "blocked" },
      },
    },
  };
}
const TEASER = '<h1>On bottlenecks</h1><p>The first ARTICLEONLYTERM paragraph.</p><p>This post is for paid subscribers. Subscribe to keep reading.</p><a href="https://essay.example.org/about">About</a>';
const READABLE = '<h1>On bottlenecks</h1><p>Every queue hides a constraint ARTICLEONLYTERM.</p><h2>Verification</h2><p>Fast verification replaced slow approvals.</p>';

interface Turn { kind: string; prompt: string; briefOnly: boolean }
/** A deterministic model: teasers are unusable, everything else gets a sourced record. */
function pipeline(hooks: { onSummary?: (turn: Turn, index: number) => Promise<void> | void; postFullObjectFails?: boolean; overview?: string } = {}) {
  const turns: Turn[] = [];
  const ai = {
    newSession: async (refID: string) => ({ sessionID: "fictional-summary-quality", refID }),
    generateObjectWithUsage: async (input: { schema: { shape?: Record<string, unknown> }; prompt: string }) => {
      const shape = input.schema.shape;
      if (!shape) return { value: { existingCollectionId: null, newCollection: null, confidence: 0, reasoning: "Fictional inbox" } };
      if ("contentStatus" in shape) {
        const turn = { kind: /Kind: (\w+)/.exec(input.prompt)![1], prompt: input.prompt, briefOnly: !("overview" in shape) };
        turns.push(turn);
        await hooks.onSummary?.(turn, turns.length - 1);
        if (hooks.postFullObjectFails && turn.kind === "tweet" && !turn.briefOnly) {
          throw new NoObjectGeneratedError({ message: "incomplete", text: "{}", response: {} as never, usage: {} as never, finishReason: "length" });
        }
        const teaser = input.prompt.includes("paid subscribers");
        const value = turn.kind === "article" && teaser || turn.kind === "link_post" && teaser || turn.kind === "tweet" && input.prompt.includes("BARELINKPOST")
          ? { contentStatus: "unusable", unusableReason: "paywall", title: "", brief: "", overview: "", keyPoints: [], sections: [] }
          : {
              contentStatus: "ok", unusableReason: null,
              title: turn.kind === "tweet" ? "Imprint ships four times faster" : "Model article title",
              brief: turn.kind === "tweet" ? "Ann says Imprint ships four times faster; the linked essay.example.org page was not read." : "Every queue hides a constraint, and verification replaced approvals.",
              overview: hooks.overview ?? `${turn.kind.toUpperCase()} OVERVIEW`,
              keyPoints: ["Verification replaced slow approvals", "Each bottleneck was named"],
              sections: [],
            };
        return { value, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
      }
      if ("tags" in shape) return { value: { tags: ["delivery"] } };
      if ("images" in shape) return { value: { images: [] } };
      if ("collectionId" in shape) return { value: { collectionId: null, confidence: 0, reason: "none" } };
      throw new Error(`Unexpected fictional turn: ${Object.keys(shape).join(",")}`);
    },
  } as unknown as AI;
  const processor = new BookmarkProcessorServiceImpl(bookmark, new ContentChunkRepositoryImpl(db), new CollectionRepositoryImpl(db), ai, new BookmarkProcessingRepositoryImpl(db), undefined,
    { getModelId: () => "fictional-embedding", embedTextsWithUsage: async (texts: string[]) => ({ value: texts.map(() => Array(1536).fill(0)) }) } as any);
  return { processor, turns };
}

async function stored(id: string) {
  return (await repository.getScrapedUrlContent(id))!;
}
async function chunkTexts(contentId: string) {
  return (await sql<{ content: string }>`SELECT t.content FROM content_chunks c JOIN text_chunks t ON t.chunk_id = c.id WHERE c.scraped_content_id = ${contentId} ORDER BY c.index`.execute(db)).rows.map((row) => row.content);
}
async function summariseTurnEvents(id: string) {
  const timeline = await new BookmarkProcessingRepositoryImpl(db).findLatestTimeline(id, owner);
  return timeline!.events.filter((event) => event.kind === "turn" && event.phase === "summarise").sort((a, b) => a.sequence - b.sequence);
}
const lexical = async (term: string) => (await repository.fullTextSearch(owner, term)).map((result) => result.bookmark.id);

it("a seeded teaser yields two ordered turns and a post-only row in Read, search and chunks", async () => {
  sources.set(POST_URL, () => xRow(TEASER));
  const saved = await bookmark.create(POST_URL, owner);
  const { processor, turns } = pipeline();

  await processor.process(saved.id, owner);

  expect(turns.map((turn) => turn.kind)).toEqual(["link_post", "tweet"]);
  expect(turns[1].prompt).toContain('links to "essay.example.org", which was not read: it returned a paywall');
  const events = await summariseTurnEvents(saved.id);
  expect(events.map((event) => [event.metadata?.kind, event.metadata?.linkedStatus, event.metadata?.contentStatus, event.metadata?.linkedUrl]))
    .toEqual([["link_post", "used", "unusable", ARTICLE_URL], ["tweet", "unreadable", "ok", ARTICLE_URL]]);

  const row = await stored(saved.id);
  expect(row.metadata.extraction).toMatchObject({ status: "complete", provider: "fxtwitter", linked: { url: ARTICLE_URL, status: "unreadable", title: "On bottlenecks" } });
  expect(row.content).toBe(postBlock);
  expect(row.links).toEqual([{ url: ARTICLE_URL, text: ARTICLE_URL }]);
  const result = (await request(`/bookmarks/${saved.id}`)).body;
  expect(result).toMatchObject({ processingStatus: "completed", title: "Imprint ships four times faster", cosmicBriefSummary: expect.stringContaining("essay.example.org page was not read") });
  expect(result.metadata.wordCount).toBe(14);
  expect(result.metadata).not.toHaveProperty("titleOrigin");
  expect(result.cosmicSummary).not.toContain("LINK_POST");

  const read = (await request(`/bookmarks/${saved.id}/content`)).body;
  expect(read.blocks).toEqual([{ kind: "quote", text: `Ann @ann · 2026-11-22 Imprint ships four times faster and POSTONLYTERM incidents fell. ${ARTICLE_URL}` }]);
  expect(await lexical("ARTICLEONLYTERM")).toEqual([]);
  expect(await lexical("POSTONLYTERM")).toEqual([saved.id]);
  const chunks = await chunkTexts(row.id);
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.join(" ")).toContain("POSTONLYTERM");
  expect(chunks.join(" ")).not.toContain("ARTICLEONLYTERM");
});

it("an interrupted run replays the post-only turn from the persisted classification", async () => {
  sources.set(POST_URL, () => xRow(TEASER));
  const saved = await bookmark.create(POST_URL, owner);
  const shutdown = new AbortController();
  const first = pipeline({ onSummary: (_turn, index) => { if (index === 1) { shutdown.abort(); throw new Error("worker stopped"); } } });

  await expect(first.processor.process(saved.id, owner, { signal: shutdown.signal })).rejects.toThrow();
  expect((await stored(saved.id)).metadata.extraction?.linked?.status).toBe("unreadable");
  sources.set(POST_URL, () => { throw new Error("A replay must reuse the stored row"); });

  const replay = pipeline();
  await replay.processor.process(saved.id, owner, { resume: true });

  expect(replay.turns.map((turn) => turn.kind)).toEqual(["tweet"]);
  expect((await request(`/bookmarks/${saved.id}`)).body).toMatchObject({ processingStatus: "completed", title: "Imprint ships four times faster" });
  expect((await stored(saved.id)).content).toBe(postBlock);
});

it("a readable link-post shows post then article in Read and search finds an article-only term", async () => {
  sources.set(POST_URL, () => xRow(READABLE));
  const saved = await bookmark.create(POST_URL, owner);
  const { processor, turns } = pipeline();

  await processor.process(saved.id, owner);

  expect(turns.map((turn) => turn.kind)).toEqual(["link_post"]);
  expect(turns[0].prompt).toContain('Linked title: "On bottlenecks"');
  expect((await request(`/bookmarks/${saved.id}`)).body).toMatchObject({ processingStatus: "completed", title: "On bottlenecks" });
  const read = (await request(`/bookmarks/${saved.id}/content`)).body;
  expect(read.blocks.map((block: { kind: string }) => block.kind)).toEqual(["quote", "heading", "paragraph", "heading", "paragraph"]);
  expect(read.blocks[1]).toEqual({ kind: "heading", text: "On bottlenecks" });
  expect(await lexical("ARTICLEONLYTERM")).toEqual([saved.id]);
});

it("a failed follow completes a post-only save that names the unread host", async () => {
  sources.set(POST_URL, () => xRow(null, "failed"));
  const saved = await bookmark.create(POST_URL, owner);
  const { processor, turns } = pipeline();

  await processor.process(saved.id, owner);

  expect(turns.map((turn) => turn.kind)).toEqual(["tweet"]);
  expect(turns[0].prompt).toContain('links to "essay.example.org", which was not read: the page could not be fetched');
  expect((await request(`/bookmarks/${saved.id}`)).body).toMatchObject({ processingStatus: "completed", title: "Imprint ships four times faster" });
});

it("a seeded standalone paywall fails with paywall and empty summaries", async () => {
  const url = "https://news.example.com/paid-story";
  sources.set(url, () => ({ title: "Paid story", content: `<article>${TEASER}</article>`, images: [], links: [], metadata: { openGraph: { title: "Paid story", site_name: "News" }, wordCount: 20, readingTime: 1, extraction: { status: "complete", provider: "direct" } } }));
  const saved = await bookmark.create(url, owner);
  await bookmark.update(saved.id, { cosmicSummary: "OLD", cosmicBriefSummary: "OLD", cosmicKeyPoints: ["OLD"] });

  await pipeline().processor.process(saved.id, owner);

  expect((await request(`/bookmarks/${saved.id}`)).body).toMatchObject({
    processingStatus: "failed", processingFailureCode: "paywall", cosmicSummary: "", cosmicBriefSummary: "", cosmicKeyPoints: [], title: "Paid story",
  });
});

it("a scoped brief-only retry on a downgraded row leaves no article overview and rebuilds search", async () => {
  sources.set(POST_URL, () => xRow(TEASER));
  const saved = await bookmark.create(POST_URL, owner);
  // First run: the model accepted the teaser as the article.
  await pipeline({ onSummary: () => undefined, overview: "ARTICLE OVERVIEW SENTINEL" }).processor.process(saved.id, owner);
  await db.updateTable("bookmarks").set({ cosmic_summary: "ARTICLE OVERVIEW SENTINEL", processing_status: "completed" }).where("id", "=", saved.id).execute();
  // Retry of summarise only: the link-post is now unusable and the post-only full object fails.
  const retry = pipeline({ postFullObjectFails: true });
  const before = (await stored(saved.id)).id;
  await sql`UPDATE scraped_url_contents SET content = ${xRow(TEASER).content}, metadata = jsonb_set(metadata, '{extraction,linked,status}', '"complete"') WHERE id = ${before}`.execute(db);

  await retry.processor.process(saved.id, owner, { phase: "summarise", resume: true });

  expect(retry.turns.map((turn) => [turn.kind, turn.briefOnly])).toEqual([["link_post", false], ["tweet", false], ["tweet", true]]);
  const result = (await request(`/bookmarks/${saved.id}`)).body;
  expect(result.cosmicSummary).toBe("");
  expect(result.cosmicBriefSummary).toContain("essay.example.org page was not read");
  expect(await lexical("ARTICLEONLYTERM")).toEqual([]);
  expect(await chunkTexts(before)).toEqual([]);
});

it("keeps prior, concurrent and same-value owner titles through fetch, Retry and Regenerate", async () => {
  const article = (url: string) => () => ({ title: "Page title", content: READABLE, images: [], links: [], metadata: { openGraph: { title: "Page title", site_name: "Essays" }, wordCount: 12, readingTime: 1, extraction: { status: "complete" as const, provider: "direct" } } });
  const cases: Array<{ url: string; edit: "prior" | "same" | "concurrent" }> = [];
  for (const edit of ["prior", "same", "concurrent"] as const) {
    cases.push({ url: `https://x.com/ann/status/${200 + cases.length}`, edit }, { url: `https://essay.example.org/${edit}`, edit });
  }
  for (const { url, edit } of cases) {
    const isX = url.startsWith("https://x.com");
    const saved = await bookmark.create(url, owner);
    const ownerTitle = edit === "same" ? saved.title : `Owner ${edit} title`;
    const patch = () => request(`/bookmarks/${saved.id}`, "PATCH", { title: ownerTitle });
    if (edit !== "concurrent") expect((await patch()).status).toBe(200);
    // A concurrent edit lands while the X summary is being written, or while the article is fetched.
    sources.set(url, isX
      ? () => ({ ...xRow(READABLE), metadata: { ...xRow(READABLE).metadata, openGraph: { ...xRow(READABLE).metadata.openGraph, url } } })
      : async () => { if (edit === "concurrent") await patch(); return article(url)(); });
    const { processor } = pipeline({ onSummary: async () => { if (isX && edit === "concurrent") await patch(); } });

    await processor.process(saved.id, owner);
    await processor.process(saved.id, owner, { phase: "summarise", resume: true });
    await processor.process(saved.id, owner, { resume: true });

    const result = (await request(`/bookmarks/${saved.id}`)).body;
    expect([url, result.title]).toEqual([url, ownerTitle]);
    expect(result.metadata).not.toHaveProperty("titleOrigin");
    const origin = await db.selectFrom("bookmarks").select(sql<string>`metadata->>'titleOrigin'`.as("origin")).where("id", "=", saved.id).executeTakeFirstOrThrow();
    expect(origin.origin).toBe("owner");
  }
});

it("a legacy row without title origin keeps its title and still renders, searches and reprocesses", async () => {
  const legacy = await repository.create({
    source_url: "https://x.com/ann/status/999", user_id: owner, title: "Tweet by Ann", quick_access: "Tweet by Ann",
    metadata: { openGraph: { title: "Tweet by Ann", site_name: X }, wordCount: 9, readingTime: 1 },
  });
  await repository.insertScrapedUrlContents(legacy.id, {
    title: "Tweet by Ann",
    content: "Ann (@ann) · 2026-10-01\n\nLEGACYTERM shipped a release.\n\nEngagement: 3 likes · 1 retweets · 0 replies\n\nSource: https://x.com/ann/status/999",
    metadata: { extraction: { status: "complete", provider: "fxtwitter" } },
  });
  const { processor, turns } = pipeline();

  await processor.process(legacy.id, owner, { resume: true });

  expect(turns.map((turn) => turn.kind)).toEqual(["tweet"]);
  const result = (await request(`/bookmarks/${legacy.id}`)).body;
  expect(result).toMatchObject({ processingStatus: "completed", title: "Tweet by Ann" });
  expect((await request(`/bookmarks/${legacy.id}/content`)).body.blocks[0].text).toBe("Ann (@ann) · 2026-10-01");
  expect(await lexical("LEGACYTERM")).toEqual([legacy.id]);
});

it("records a typed save title as the owner's and a reshared one as provisional", async () => {
  const origin = async (id: string) => (await db.selectFrom("bookmarks").select(sql<string>`metadata->>'titleOrigin'`.as("origin")).where("id", "=", id).executeTakeFirstOrThrow()).origin;
  const typed = await bookmark.create("https://essay.example.org/typed", owner, { title: "My reading note title" });
  const reshared = await bookmark.create("https://essay.example.org/reshared", owner, { title: "Original owner's title", savedFromBookmarkId: typed.id });
  const plain = await bookmark.create("https://essay.example.org/plain", owner);

  expect([await origin(typed.id), await origin(reshared.id), await origin(plain.id)]).toEqual(["owner", "pipeline", "pipeline"]);
  for (const url of ["https://essay.example.org/typed", "https://essay.example.org/reshared"]) {
    sources.set(url, () => ({ title: "Page title", content: READABLE, images: [], links: [], metadata: { openGraph: { title: "Page title", site_name: "Essays" }, wordCount: 12, readingTime: 1, extraction: { status: "complete" as const, provider: "direct" } } }));
  }
  await pipeline().processor.process(typed.id, owner);
  await pipeline().processor.process(reshared.id, owner);

  expect((await request(`/bookmarks/${typed.id}`)).body.title).toBe("My reading note title");
  expect((await request(`/bookmarks/${reshared.id}`)).body.title).toBe("Page title");
});
