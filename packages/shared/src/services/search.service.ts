import { streamText } from "ai";
import { Bookmark } from "../types";
import {
  BookmarkRepository,
  FullTextSearchResult,
  VectorSearchResult,
  SearchOptions,
} from "../repositories/bookmark.repository";
import { CollectionRepository } from "../repositories/collection.repository";
import { EmbeddingService } from "./embedding.service";
import { mapDatabaseRowToBookmark } from "./bookmark.service";
import { AI } from "../ai";

/**
 * How a result earned its place in the list.
 *
 * `keyword` — the query's words are literally in the save. `semantic` — it was
 * reached only through vector similarity, so nothing the reader typed appears
 * in it, and `/search` has to say so with a `Related` tag rather than leave an
 * apparently unrelated row sitting in the list unexplained.
 */
export type SearchMatchKind = "keyword" | "semantic";

export type SearchReadStatus = "all" | "unread" | "read";
export type SearchDateRange = "any" | "week" | "month" | "year";

/**
 * The four filters `/search` offers, straight off the page.
 *
 * Applied here rather than in the repository's SQL on purpose. Fusing two
 * ranked lists is what this service is for, and a filter pushed down into both
 * arms would have to be written twice — once against `bookmarks` for full
 * text, once across the four-table join for vectors — and kept in step
 * forever. Filtering the fused list is one implementation of one rule, and it
 * is a pure function over a `Bookmark`, which is how it comes to be tested at
 * all: the SQL paths only run against a live database.
 *
 * The cost is that filtering after truncation could starve a narrow filter, so
 * a filtered search asks each arm for more candidates up front — see
 * `CANDIDATE_MULTIPLIER`.
 */
export interface SearchFilters {
  /** Saves filed directly in this collection. */
  collectionId?: string;
  /** Matched case-insensitively against `cosmicTags`. */
  tag?: string;
  readStatus?: SearchReadStatus;
  dateRange?: SearchDateRange;
}

export interface HybridSearchResult {
  bookmark: Bookmark;
  score: number;
  matchedChunks: string[];
  match: SearchMatchKind;
}

/**
 * One bookmark an answer was built from.
 *
 * Rule 8: no AI output ships without naming its sources, and a source that is
 * not a link is not provenance — hence `bookmarkId` on every one of them.
 */
export interface SearchAnswerSource {
  bookmarkId: string;
  title: string;
  /** Bare host — `every.to`, not `https://every.to/`. */
  domain: string;
  faviconUrl?: string;
}

export interface AskHandlers {
  /**
   * The bookmarks the answer will be built from. Always called, always first,
   * and always before any chunk. An empty array means no answer follows.
   */
  onSources: (sources: SearchAnswerSource[]) => void;
  onChunk: (chunk: string) => void;
  /** The full result rows, for the list beneath the answer. */
  onResults: (results: HybridSearchResult[]) => void;
}

export interface SearchService {
  hybridSearch(
    userId: string,
    query: string,
    options?: SearchOptions & SearchFilters
  ): Promise<HybridSearchResult[]>;

  askWithContext(
    userId: string,
    query: string,
    handlers: AskHandlers
  ): Promise<void>;
}

const RRF_K = 60;

/**
 * How many candidates each arm is asked for, as a multiple of `limit`.
 *
 * Two without filters — enough overlap for the fusion to have something to
 * fuse. Six with them, because everything the filter rejects is a slot the
 * reader never sees, and a collection filter on a large library rejects most
 * of what comes back.
 */
const CANDIDATE_MULTIPLIER = { unfiltered: 2, filtered: 6 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RANGE_DAYS: Record<Exclude<SearchDateRange, "any">, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export function hasSearchFilters(filters: SearchFilters): boolean {
  return Boolean(
    filters.collectionId ||
      filters.tag ||
      (filters.readStatus && filters.readStatus !== "all") ||
      (filters.dateRange && filters.dateRange !== "any")
  );
}

/**
 * Does this save survive the reader's filters?
 *
 * Pure, and exported so it can be tested without a database — which is the
 * whole reason the filters live in the service rather than in the SQL.
 */
export function matchesSearchFilters(
  bookmark: Bookmark,
  filters: SearchFilters,
  now: Date = new Date()
): boolean {
  if (filters.collectionId && bookmark.collectionId !== filters.collectionId) {
    return false;
  }

  if (filters.tag) {
    const wanted = filters.tag.toLowerCase();
    const tags = (bookmark.cosmicTags ?? []).map((tag) => tag.toLowerCase());
    if (!tags.includes(wanted)) return false;
  }

  const readStatus = filters.readStatus ?? "all";
  if (readStatus !== "all") {
    const read = bookmark.isRead ?? Boolean(bookmark.readAt);
    if (readStatus === "read" && !read) return false;
    if (readStatus === "unread" && read) return false;
  }

  const dateRange = filters.dateRange ?? "any";
  if (dateRange !== "any") {
    const createdAt = bookmark.createdAt
      ? new Date(bookmark.createdAt).getTime()
      : NaN;
    if (Number.isNaN(createdAt)) return false;
    if (now.getTime() - createdAt > DATE_RANGE_DAYS[dateRange] * DAY_MS) {
      return false;
    }
  }

  return true;
}

/** Bare host, or an empty string when the URL will not parse. */
export function searchSourceDomain(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The sources an answer may cite — one per result, in rank order.
 *
 * Exported because "an answer names its sources" is the rule this file exists
 * to keep, and a rule worth keeping is worth being able to assert on directly.
 */
export function answerSourcesFrom(
  results: HybridSearchResult[]
): SearchAnswerSource[] {
  return results.map((result) => ({
    bookmarkId: result.bookmark.id,
    title: result.bookmark.title?.trim() || "Untitled",
    domain: searchSourceDomain(result.bookmark.sourceUrl),
    faviconUrl: result.bookmark.metadata?.openGraph?.favicon ?? undefined,
  }));
}

/**
 * Whether these results can carry an answer at all.
 *
 * No sources, no answer — not "an answer that says it found nothing", which is
 * still an AI output with an empty `.ai-foot` and is exactly what rule 8
 * forbids. The empty case is the search surface's empty state, and an empty
 * state is not something a language model needs to be asked to write.
 */
export function canAnswer(sources: SearchAnswerSource[]): boolean {
  return sources.length > 0;
}

export class SearchServiceImpl implements SearchService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private embeddingService: EmbeddingService,
    private ai: AI,
    private collectionRepository?: CollectionRepository
  ) {}

  async hybridSearch(
    userId: string,
    query: string,
    options: SearchOptions & SearchFilters = {}
  ): Promise<HybridSearchResult[]> {
    const { limit = 20, collectionId, tag, readStatus, dateRange, ...rest } =
      options;

    const filters: SearchFilters = { collectionId, tag, readStatus, dateRange };
    const candidates =
      limit *
      (hasSearchFilters(filters)
        ? CANDIDATE_MULTIPLIER.filtered
        : CANDIDATE_MULTIPLIER.unfiltered);

    const searchOptions: SearchOptions = { ...rest, limit: candidates };

    const ftsPromise = this.bookmarkRepository.fullTextSearch(
      userId,
      query,
      searchOptions
    );

    const vectorPromise = this.embeddingService
      .embedText(query)
      .then((embedding) =>
        this.bookmarkRepository.vectorSearch(userId, embedding, searchOptions)
      );

    const [ftsSettled, vectorSettled] = await Promise.allSettled([
      ftsPromise,
      vectorPromise,
    ]);

    const ftsResults =
      ftsSettled.status === "fulfilled" ? ftsSettled.value : [];
    const vectorResults =
      vectorSettled.status === "fulfilled" ? vectorSettled.value : [];

    if (ftsSettled.status === "rejected") {
      console.error("Full-text search failed:", ftsSettled.reason);
    }
    if (vectorSettled.status === "rejected") {
      console.error("Vector search failed:", vectorSettled.reason);
    }

    const fused = this.fuseResults(ftsResults, vectorResults, filters, limit);

    return this.enrichWithCollections(fused);
  }

  async askWithContext(
    userId: string,
    query: string,
    handlers: AskHandlers
  ): Promise<void> {
    const results = await this.hybridSearch(userId, query, { limit: 10 });
    handlers.onResults(results);

    // Sources before prose, always. The client is told what the answer will be
    // built from before a single word of it arrives, so it can never end up
    // rendering a paragraph it has no provenance for.
    const sources = answerSourcesFrom(results);
    handlers.onSources(sources);

    if (!canAnswer(sources)) return;

    const context = this.buildRAGContext(results);

    const model = this.ai.getModel(
      process.env.RAG_MODEL || "google/gemini-2.5-flash"
    );

    const result = streamText({
      model,
      system: `You are a helpful assistant that answers questions based on the user's bookmarked content. Use the provided context to answer accurately. If the context doesn't contain enough information, say so. Always cite which bookmarks your answer is based on using their titles. Be concise and direct.`,
      prompt: `Context from bookmarks:\n\n${context}\n\nUser question: ${query}`,
    });

    for await (const textPart of result.textStream) {
      handlers.onChunk(textPart);
    }
  }

  /**
   * Give each row the collection it is filed in, so a search result can render
   * the same breadcrumb the Library row does.
   *
   * One level deep and one query wide, matching what the Library list itself
   * does — rolling a child into its parent is the client's call, and this
   * product caps collections at two levels anyway.
   */
  private async enrichWithCollections(
    results: HybridSearchResult[]
  ): Promise<HybridSearchResult[]> {
    if (!this.collectionRepository) return results;

    const ids = [
      ...new Set(
        results
          .map((result) => result.bookmark.collectionId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (ids.length === 0) return results;

    try {
      const collections =
        await this.collectionRepository.getCollectionsByIds(ids);

      return results.map((result) => {
        const id = result.bookmark.collectionId;
        const collection = id ? collections.get(id) : undefined;
        if (!collection) return result;

        return {
          ...result,
          bookmark: { ...result.bookmark, collectionPath: [collection] },
        };
      });
    } catch (error) {
      // A missing breadcrumb is a worse row, not a failed search.
      console.error("Failed to enrich search results with collections:", error);
      return results;
    }
  }

  private buildRAGContext(results: HybridSearchResult[]): string {
    return results
      .map((result, index) => {
        const { bookmark, matchedChunks } = result;
        const chunks =
          matchedChunks.length > 0
            ? matchedChunks.join("\n")
            : bookmark.cosmicBriefSummary || "";

        return `[${index + 1}] "${bookmark.title || "Untitled"}" (${bookmark.sourceUrl})\n${chunks}`;
      })
      .join("\n\n");
  }

  private fuseResults(
    ftsResults: FullTextSearchResult[],
    vectorResults: VectorSearchResult[],
    filters: SearchFilters,
    limit: number
  ): HybridSearchResult[] {
    const scores = new Map<
      string,
      { score: number; matchedChunks: string[]; match: SearchMatchKind }
    >();
    const bookmarks = new Map<string, Bookmark>();

    for (let i = 0; i < ftsResults.length; i++) {
      // The repositories hand back raw rows. Mapping them here is what makes a
      // search result the same shape as a bookmark from anywhere else in the
      // API — without it `sourceUrl`, `cosmicBriefSummary` and `isRead` all
      // arrive at the client under their column names and read as absent.
      const bookmark = mapDatabaseRowToBookmark(ftsResults[i].bookmark);
      const rrfScore = 1 / (RRF_K + i + 1);
      bookmarks.set(bookmark.id, bookmark);

      const existing = scores.get(bookmark.id);
      scores.set(bookmark.id, {
        score: (existing?.score ?? 0) + rrfScore,
        matchedChunks: existing?.matchedChunks ?? [],
        // A literal hit is a literal hit however else the row was reached.
        match: "keyword",
      });
    }

    for (let i = 0; i < vectorResults.length; i++) {
      const { matchedChunk } = vectorResults[i];
      const bookmark = mapDatabaseRowToBookmark(vectorResults[i].bookmark);
      const rrfScore = 1 / (RRF_K + i + 1);
      bookmarks.set(bookmark.id, bookmark);

      const existing = scores.get(bookmark.id);
      const chunks = existing?.matchedChunks ?? [];
      if (matchedChunk) {
        chunks.push(matchedChunk);
      }

      scores.set(bookmark.id, {
        score: (existing?.score ?? 0) + rrfScore,
        matchedChunks: chunks,
        match: existing?.match ?? "semantic",
      });
    }

    const now = new Date();

    return Array.from(scores.entries())
      .map(([id, { score, matchedChunks, match }]) => ({
        bookmark: bookmarks.get(id)!,
        score,
        matchedChunks,
        match,
      }))
      .filter((result) => matchesSearchFilters(result.bookmark, filters, now))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
