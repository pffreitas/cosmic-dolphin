import { streamText } from "ai";
import { Bookmark } from "../types";
import {
  BookmarkRepository,
  FullTextSearchResult,
  VectorSearchResult,
  SearchOptions,
} from "../repositories/bookmark.repository";
import { EmbeddingService } from "./embedding.service";
import { AI } from "../ai";

export interface HybridSearchResult {
  bookmark: Bookmark;
  score: number;
  matchedChunks: string[];
}

export interface SearchService {
  hybridSearch(
    userId: string,
    query: string,
    options?: SearchOptions
  ): Promise<HybridSearchResult[]>;

  askWithContext(
    userId: string,
    query: string,
    onChunk: (chunk: string) => void,
    onResults: (results: HybridSearchResult[]) => void
  ): Promise<void>;
}

const RRF_K = 60;

export class SearchServiceImpl implements SearchService {
  constructor(
    private bookmarkRepository: BookmarkRepository,
    private embeddingService: EmbeddingService,
    private ai: AI
  ) {}

  async hybridSearch(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    const { limit = 20 } = options;

    const ftsPromise = this.bookmarkRepository.fullTextSearch(userId, query, {
      ...options,
      limit: limit * 2,
    });

    const vectorPromise = this.embeddingService
      .embedText(query)
      .then((embedding) =>
        this.bookmarkRepository.vectorSearch(userId, embedding, {
          ...options,
          limit: limit * 2,
        })
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

    return this.fuseResults(ftsResults, vectorResults, limit);
  }

  async askWithContext(
    userId: string,
    query: string,
    onChunk: (chunk: string) => void,
    onResults: (results: HybridSearchResult[]) => void
  ): Promise<void> {
    const results = await this.hybridSearch(userId, query, { limit: 10 });
    onResults(results);

    if (results.length === 0) {
      onChunk(
        "I couldn't find any relevant bookmarks matching your query. Try different keywords or save more content to your library."
      );
      return;
    }

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
      onChunk(textPart);
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
    limit: number
  ): HybridSearchResult[] {
    const scores = new Map<
      string,
      { score: number; matchedChunks: string[] }
    >();
    const bookmarks = new Map<string, any>();

    for (let i = 0; i < ftsResults.length; i++) {
      const { bookmark } = ftsResults[i];
      const rrfScore = 1 / (RRF_K + i + 1);
      bookmarks.set(bookmark.id, bookmark);

      const existing = scores.get(bookmark.id);
      scores.set(bookmark.id, {
        score: (existing?.score ?? 0) + rrfScore,
        matchedChunks: existing?.matchedChunks ?? [],
      });
    }

    for (let i = 0; i < vectorResults.length; i++) {
      const { bookmark, matchedChunk } = vectorResults[i];
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
      });
    }

    return Array.from(scores.entries())
      .map(([id, { score, matchedChunks }]) => ({
        bookmark: bookmarks.get(id)!,
        score,
        matchedChunks,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
