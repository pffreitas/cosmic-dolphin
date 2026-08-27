import { Bookmark, BookmarkImage, ScrapedUrlContents } from "../types";
import { BookmarkService } from "./bookmark.service";
import { AI } from "../ai";
import { z } from "zod";
import {
  GENERATE_TAGS_PROMPT,
  FILTER_IMAGES_PROMPT,
  SUMMARIZE_PROMPT,
  BRIEF_SUMMARY_PROMPT,
  SUMMARIZE_YOUTUBE_PROMPT,
  BRIEF_SUMMARY_YOUTUBE_PROMPT,
  SUMMARIZE_TWEET_PROMPT,
  BRIEF_SUMMARY_TWEET_PROMPT,
} from "../services/bookmark.processor.prompt";
import { Session } from "../ai/types";
import { Identifier } from "../ai/id";
import { ContentChunkRepository } from "../repositories/content-chunk.repository";
import { HttpClient, CosmicHttpClient } from "./http-client";
import {
  BookmarkCategorizerService,
  BookmarkCategorizerServiceImpl,
} from "./bookmark.categorizer.service";
import { CollectionRepository } from "../repositories/collection.repository";
import { ChunkingService, ChunkingServiceImpl } from "./chunking.service";
import { EmbeddingService, EmbeddingServiceImpl } from "./embedding.service";
import { BOOKMARK_MODEL_IDS } from "./bookmark.model-ids";
import { BookmarkProcessingRepository } from "../repositories/bookmark-processing.repository";
import {
  BookmarkProcessingPhaseName,
  BookmarkProcessingPhaseReporter,
  BookmarkProcessingReporter,
} from "./bookmark-processing-reporter.service";

export interface BookmarkProcessOptions {
  /**
   * Run only this phase. Absent runs the whole pipeline. Set by
   * `POST /bookmarks/{id}/reprocess` when the user retries one failed line of
   * the checklist rather than the whole thing.
   */
  phase?: BookmarkProcessingPhaseName;
  /**
   * Append to the bookmark's existing timeline instead of opening a new run.
   * True for every reprocess — see `BookmarkProcessingReporter.resumeRun`.
   */
  resume?: boolean;
}

export interface BookmarkProcessorService {
  process(
    id: string,
    userId: string,
    options?: BookmarkProcessOptions
  ): Promise<void>;
}

/**
 * Pulls the key points out of the full brief.
 *
 * The summariser writes markdown with a `## Key Points` section; the reader
 * needs an array. Doing the parse once, here, is the whole point of
 * `bookmarks.cosmic_key_points` — parsing markdown in a render pass means
 * every list row re-parses a document to draw three bullets, and any
 * formatting drift becomes a rendering bug rather than a pipeline one.
 *
 * Findings, not a sequence: 2–5 of them, each ≤ 140 characters
 * (docs/functional-spec/03-ai-pipeline.md § Outputs). The UI renders them with
 * a dot marker and never numbers them.
 */
const MAX_KEY_POINTS = 5;
const MAX_KEY_POINT_LENGTH = 140;

export function extractKeyPoints(summary: string | undefined | null): string[] {
  if (!summary) return [];

  const lines = summary.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    /^\s{0,3}#{1,6}\s*key\s+points\s*:?\s*$/i.test(line)
  );
  if (headingIndex === -1) return [];

  const points: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) break;

    const bullet = line.match(/^\s{0,3}(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (!bullet) continue;

    const point = cleanKeyPoint(bullet[1]);
    if (point) points.push(point);
    if (points.length === MAX_KEY_POINTS) break;
  }

  return points;
}

function cleanKeyPoint(raw: string): string {
  const text = raw
    // `[label](href)` → `label`. A key point is read, never followed.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= MAX_KEY_POINT_LENGTH) return text;

  // Cut on a word boundary rather than mid-word, and say it was cut.
  const clipped = text.slice(0, MAX_KEY_POINT_LENGTH - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 60 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.\s]+$/, "")}…`;
}

const PRIVATE_LINK_ENRICHMENT_PROMPT = `You are creating a private link quick-access record.
The page content is inaccessible, so do not summarize or claim facts from the page.
Use only the URL, title, and user description to create locator metadata.

URL: {{URL}}
Title: {{TITLE}}
User description: {{DESCRIPTION}}

Return:
- title: A short useful title for the saved link.
- description: A polished 1-2 sentence description based only on the user's description.
- tags: 3-6 lowercase tags. Use hyphens for multi-word tags.
- quickAccessKeywords: 3-8 phrases the user might search for later.`;

interface ChunkingResult {
  textChunkIds: string[];
  chunkTexts: string[];
}

interface PhaseFailure {
  phase: BookmarkProcessingPhaseName;
  error: string;
}

interface SummariseResult {
  summary: string;
  briefSummary: string;
  keyPoints: string[];
}

export class BookmarkProcessorServiceImpl implements BookmarkProcessorService {
  private categorizerService: BookmarkCategorizerService;
  private chunkingService: ChunkingService;
  private embeddingService: EmbeddingService;

  constructor(
    private bookmarkService: BookmarkService,
    private contentChunkRepository: ContentChunkRepository,
    private collectionRepository: CollectionRepository,
    private ai: AI,
    private bookmarkProcessingRepository: BookmarkProcessingRepository,
    private httpClient: HttpClient = new CosmicHttpClient(),
    chunkingService?: ChunkingService,
    embeddingService?: EmbeddingService
  ) {
    this.categorizerService = new BookmarkCategorizerServiceImpl(
      collectionRepository,
      ai
    );
    this.chunkingService = chunkingService ?? new ChunkingServiceImpl();
    this.embeddingService = embeddingService ?? new EmbeddingServiceImpl();
  }

  /**
   * The pipeline, as the UI names it.
   *
   * Six phases in order — `fetch`, `extract`, `summarise`, `tag`, `file`,
   * `embed` — sequential and independently retryable
   * (docs/functional-spec/03-ai-pipeline.md § Phases). They used to run in
   * parallel under nine internal names; a checklist cannot show four things
   * finishing at once, and the two summary calls were two lines for one
   * *Summarising…* step.
   *
   * **Partial failure is normal and must survive.** Only `fetch` is fatal:
   * without the page there is nothing for any later phase to work on. Every
   * other phase is run softly — it records a failed event, and the pipeline
   * carries on with what it has. A bookmark whose `summarise` failed still
   * gets its tags, its filing and its content; the run ends `failed`, and the
   * UI shows the failed line in place of the brief, not in place of the page.
   */
  async process(
    id: string,
    userId: string,
    options: BookmarkProcessOptions = {}
  ): Promise<void> {
    const existingBookmark = await this.bookmarkService.findByIdAndUser(
      id,
      userId
    );
    if (!existingBookmark) {
      throw new Error(`Bookmark not found: ${id}`);
    }

    let bookmark = existingBookmark;
    const isPrivateLink = bookmark.isPrivateLink;

    // Update processing status to 'processing'
    bookmark = await this.bookmarkService.updateProcessingStatus(
      bookmark.id,
      "processing"
    );

    const reporter = new BookmarkProcessingReporter(
      this.bookmarkProcessingRepository
    );
    const failures: PhaseFailure[] = [];

    try {
      if (options.resume) {
        await reporter.resumeRun(bookmark.id, userId);
      } else {
        await reporter.startRun(bookmark.id, userId);
      }
      const session = await this.ai.newSession(bookmark.id);
      const inScope = (phase: BookmarkProcessingPhaseName) =>
        !options.phase || options.phase === phase;

      if (isPrivateLink) {
        bookmark = await this.processPrivateLink(
          session,
          bookmark,
          reporter,
          inScope,
          failures
        );
      } else {
        // Fetching the page is the pipeline's first phase, not the API's.
        // `POST /bookmarks` used to await this before replying, which put a
        // third-party server on the critical path of every save. Doing it here
        // means an unreachable host is a failed phase on a row the user already
        // has — the bookmark and the URL survive, which is the whole point.
        //
        // Outside its own scope the fetch still has to happen — a retry of
        // `summarise` needs the page — but it is idempotent and silent, so
        // retrying one phase does not redraw a *Fetched page* line the user
        // watched succeed an hour ago.
        const scrapedContent = inScope("fetch")
          ? await reporter.trackPhase("fetch", "Fetch page", () =>
              this.requireScrapedContent(bookmark)
            )
          : await this.requireScrapedContent(bookmark);

        if (inScope("extract")) {
          // `wordCount`, `readingTime` and the readable body were written by
          // the fetch; what is left to extract is which of the page's images
          // are actually about the article.
          const images = await this.runPhase(
            reporter,
            "extract",
            "Extract content",
            failures,
            (phaseReporter) =>
              this.isTwitterBookmark(bookmark)
                ? Promise.resolve(this.promoteTweetImages(scrapedContent))
                : this.processImages(
                    session,
                    bookmark,
                    scrapedContent,
                    phaseReporter
                  )
          );
          if (images) bookmark.cosmicImages = images;
        }

        if (inScope("summarise")) {
          const summarised = await this.runPhase(
            reporter,
            "summarise",
            "Summarise content",
            failures,
            (phaseReporter) =>
              this.summarise(session, bookmark, scrapedContent, phaseReporter)
          );
          if (summarised) {
            bookmark.cosmicSummary = summarised.summary;
            bookmark.cosmicBriefSummary = summarised.briefSummary;
            bookmark.cosmicKeyPoints = summarised.keyPoints;
          }
        }

        if (inScope("tag")) {
          const tags = await this.runPhase(
            reporter,
            "tag",
            "Generate tags",
            failures,
            (phaseReporter) =>
              this.generateMetadata(
                session,
                bookmark,
                scrapedContent,
                phaseReporter
              )
          );
          if (tags) bookmark.cosmicTags = tags;
        }

        if (inScope("file")) {
          // Filing runs on whatever summarise and tag actually produced. It is
          // a suggestion either way — see D6 for the override rule.
          const categorization = await this.runPhase(
            reporter,
            "file",
            "File into a collection",
            failures,
            (phaseReporter) =>
              this.categorizerService.categorize(
                session,
                bookmark,
                scrapedContent,
                phaseReporter
              )
          );
          if (categorization) bookmark.collectionId = categorization.categoryId;
        }

        if (inScope("embed")) {
          // Silent by design: no user-legible output, so no line in the
          // checklist and no bearing on whether the run counts as failed.
          await this.runPhase(
            reporter,
            "embed",
            "Embed content chunks",
            null,
            async (phaseReporter) => {
              const chunks = await this.chunkContent(scrapedContent);
              await this.embedChunks(chunks, phaseReporter);
            }
          );
        }

        bookmark.searchDocument = this.buildSearchDocument(
          bookmark,
          scrapedContent
        );
      }

      // One write for everything the run produced. Fields a failed phase never
      // filled in keep whatever the bookmark already had — a failure subtracts
      // nothing from the row.
      await this.bookmarkService.update(id, bookmark);

      if (failures.length > 0) {
        const message = failures
          .map((failure) => `${failure.phase}: ${failure.error}`)
          .join("; ");
        await this.bookmarkService.updateProcessingStatus(id, "failed", message);
        await reporter.failRun(message);
        return;
      }

      await this.bookmarkService.updateProcessingStatus(id, "completed");
      await reporter.completeRun();
    } catch (error) {
      // Only a fatal phase reaches here — the fetch, or the timeline itself
      // being unavailable. Everything else was already absorbed by `runPhase`.
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.bookmarkService.updateProcessingStatus(
        id,
        "failed",
        errorMessage
      );
      if (reporter.hasStarted()) {
        await reporter.failRun(errorMessage);
      }
      throw error;
    }
  }

  private async requireScrapedContent(
    bookmark: Bookmark
  ): Promise<ScrapedUrlContents> {
    const fetched = await this.bookmarkService.ensureScrapedContent(bookmark);
    if (!fetched) {
      throw new Error(`Scraped url content not found: ${bookmark.id}`);
    }
    return fetched;
  }

  /**
   * Track a phase and absorb its failure.
   *
   * The event is still written as failed — the user sees exactly which line
   * broke and can retry that one — but the pipeline keeps going. Pass `null`
   * for `failures` to make the phase advisory: recorded, but not counted
   * against the run (that is `embed`, which the reader never sees).
   */
  private async runPhase<T>(
    reporter: BookmarkProcessingReporter,
    phase: BookmarkProcessingPhaseName,
    name: string,
    failures: PhaseFailure[] | null,
    work: (phaseReporter: BookmarkProcessingPhaseReporter) => Promise<T>
  ): Promise<T | undefined> {
    try {
      return await reporter.trackPhase(phase, name, work);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Bookmark processing phase "${phase}" failed:`, error);
      failures?.push({ phase, error: message });
      return undefined;
    }
  }

  private isYouTubeBookmark(bookmark: Bookmark): boolean {
    return bookmark.metadata?.openGraph?.site_name === "YouTube";
  }

  private isTwitterBookmark(bookmark: Bookmark): boolean {
    return bookmark.metadata?.openGraph?.site_name === "X (formerly Twitter)";
  }

  /**
   * A private link has no page to fetch, so the pipeline runs two phases on it:
   * `extract`, which turns the user's own note into a legible record, and
   * `file`. Both are soft — a private link that the model could not polish is
   * still the link the user saved, with the description they wrote.
   */
  private async processPrivateLink(
    session: Session,
    bookmark: Bookmark,
    reporter: BookmarkProcessingReporter,
    inScope: (phase: BookmarkProcessingPhaseName) => boolean,
    failures: PhaseFailure[]
  ): Promise<Bookmark> {
    const context = bookmark.metadata?.privateLink;
    const userDescription =
      context?.userDescription ||
      bookmark.cosmicBriefSummary ||
      bookmark.metadata?.openGraph?.description ||
      "";

    let enriched = bookmark;

    if (inScope("extract")) {
      const enrichment = await this.runPhase(
        reporter,
        "extract",
        "Extract private link details",
        failures,
        (phaseReporter) =>
          phaseReporter.trackTurn(
            "Generate private link metadata",
            BOOKMARK_MODEL_IDS.small,
            async () =>
              this.ai.generateObjectWithUsage({
                sessionID: session.sessionID,
                modelId: BOOKMARK_MODEL_IDS.small,
                prompt: PRIVATE_LINK_ENRICHMENT_PROMPT
                  .replace("{{URL}}", bookmark.sourceUrl)
                  .replace("{{TITLE}}", bookmark.title || "Untitled")
                  .replace(
                    "{{DESCRIPTION}}",
                    userDescription || "No description"
                  ),
                schema: z.object({
                  title: z.string().describe("A concise bookmark title"),
                  description: z
                    .string()
                    .describe("A polished description based only on user input"),
                  tags: z
                    .array(z.string())
                    .describe("Search and categorization tags"),
                  quickAccessKeywords: z
                    .array(z.string())
                    .describe("Additional phrases for quick access search"),
                }),
              })
          )
      );

      if (enrichment) {
        const tags = this.normalizeTags(enrichment.tags);
        enriched = {
          ...bookmark,
          title: enrichment.title || bookmark.title,
          cosmicBriefSummary: enrichment.description || userDescription,
          cosmicTags: tags,
          quickAccess: this.buildPrivateLinkQuickAccess(
            bookmark,
            enrichment.title,
            enrichment.description,
            tags,
            enrichment.quickAccessKeywords
          ),
          metadata: {
            ...bookmark.metadata,
            privateLink: {
              userDescription,
              userProvidedTitle: context?.userProvidedTitle,
              enrichedAt: new Date().toISOString(),
            },
          },
        };
      }
    }

    if (inScope("file")) {
      const syntheticContent = this.buildPrivateLinkSyntheticContent(enriched);
      const categorization = await this.runPhase(
        reporter,
        "file",
        "File private link into a collection",
        failures,
        (phaseReporter) =>
          this.categorizerService.categorize(
            session,
            enriched,
            syntheticContent,
            phaseReporter
          )
      );
      if (categorization) enriched.collectionId = categorization.categoryId;
    }

    return enriched;
  }

  private normalizeTags(tags: string[]): string[] {
    return [
      ...new Set(
        tags
          .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
          .filter(Boolean)
      ),
    ];
  }

  private buildPrivateLinkQuickAccess(
    bookmark: Bookmark,
    title: string,
    description: string,
    tags: string[],
    quickAccessKeywords: string[]
  ): string {
    return [
      title,
      bookmark.sourceUrl,
      description,
      tags.join(" "),
      quickAccessKeywords.join(" "),
    ]
      .filter(Boolean)
      .join(" ");
  }

  private buildPrivateLinkSyntheticContent(
    bookmark: Bookmark
  ): ScrapedUrlContents {
    return {
      id: `private-link-${bookmark.id}`,
      bookmarkId: bookmark.id,
      title: bookmark.title || "",
      content: [
        bookmark.title || "",
        bookmark.sourceUrl,
        bookmark.cosmicBriefSummary || "",
        bookmark.cosmicTags?.join(" ") || "",
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: bookmark.metadata || {},
      images: [],
      links: [],
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
    };
  }

  private promoteTweetImages(content: ScrapedUrlContents): BookmarkImage[] {
    return (content.images ?? []).map((img) => ({
      url: img.url,
      title: img.alt ?? "Tweet media",
      description: img.alt ?? "Media attached to the tweet",
    }));
  }

  /**
   * One phase, three outputs: the full brief, the 1–2 sentence brief summary,
   * and the key points the brief is read through.
   *
   * The two model calls are independent, so they run together — but they are
   * two `turn` events under a single `summarise` phase. The user is watching
   * one line called *Summarising…*; how many calls it takes is accounting, not
   * progress.
   */
  private async summarise(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents,
    phaseReporter: BookmarkProcessingPhaseReporter
  ): Promise<SummariseResult> {
    // `allSettled`, not `all`: with `all` a rejection from the slower call
    // lands after the phase has already been failed by the faster one, and
    // Node reports it as an unhandled rejection that kills the worker.
    const [summary, briefSummary] = await Promise.allSettled([
      this.generateSummary(session, bookmark, content, phaseReporter),
      this.generateBriefSummary(session, bookmark, content, phaseReporter),
    ]);

    if (summary.status === "rejected") throw summary.reason;
    if (briefSummary.status === "rejected") throw briefSummary.reason;

    return {
      summary: summary.value,
      briefSummary: briefSummary.value,
      keyPoints: extractKeyPoints(summary.value),
    };
  }

  private async generateSummary(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents,
    phaseReporter: BookmarkProcessingPhaseReporter
  ): Promise<string> {
    const { summarizePrompt, textContent } =
      this.getSummarizationContext(bookmark, content);

    return phaseReporter.trackTurn(
      "Generate full summary",
      BOOKMARK_MODEL_IDS.large,
      async () =>
        this.ai.generateText({
          sessionID: session.sessionID,
          taskID: Identifier.ascending("task"),
          messageID: Identifier.ascending("message"),
          modelId: BOOKMARK_MODEL_IDS.large,
          context: [],
          tools: [],
          message: {
            role: "user",
            content: summarizePrompt.replace("{{CONTENT}}", textContent),
          },
        })
    );
  }

  private async generateBriefSummary(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents,
    phaseReporter: BookmarkProcessingPhaseReporter
  ): Promise<string> {
    const { briefPrompt, textContent } = this.getSummarizationContext(
      bookmark,
      content
    );

    return phaseReporter.trackTurn(
      "Generate brief summary",
      BOOKMARK_MODEL_IDS.small,
      async () =>
        this.ai.generateObjectWithUsage({
          sessionID: session.sessionID,
          modelId: BOOKMARK_MODEL_IDS.small,
          prompt: briefPrompt.replace("{{CONTENT}}", textContent),
          schema: z.string().describe("The summary of the content"),
        })
    );
  }

  private async generateMetadata(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents,
    phaseReporter: BookmarkProcessingPhaseReporter
  ): Promise<string[]> {
    const response = await phaseReporter.trackTurn(
      "Generate tags",
      BOOKMARK_MODEL_IDS.small,
      async () =>
        this.ai.generateObjectWithUsage({
          sessionID: session.sessionID,
          modelId: BOOKMARK_MODEL_IDS.small,
          prompt: GENERATE_TAGS_PROMPT.replace(
            "{{CONTENT}}",
            this.getProcessableText(bookmark, content)
          ),
          schema: z.object({
            tags: z.array(z.string()).describe("The array of tag strings"),
          }),
        })
    );

    return response.tags;
  }

  private getSummarizationContext(
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): { summarizePrompt: string; briefPrompt: string; textContent: string } {
    const isYouTube = this.isYouTubeBookmark(bookmark);
    const isTwitter = this.isTwitterBookmark(bookmark);

    let summarizePrompt: string;
    let briefPrompt: string;
    if (isTwitter) {
      summarizePrompt = SUMMARIZE_TWEET_PROMPT;
      briefPrompt = BRIEF_SUMMARY_TWEET_PROMPT;
    } else if (isYouTube) {
      summarizePrompt = SUMMARIZE_YOUTUBE_PROMPT;
      briefPrompt = BRIEF_SUMMARY_YOUTUBE_PROMPT;
    } else {
      summarizePrompt = SUMMARIZE_PROMPT;
      briefPrompt = BRIEF_SUMMARY_PROMPT;
    }

    return {
      summarizePrompt,
      briefPrompt,
      textContent: this.getProcessableText(bookmark, content),
    };
  }

  private getProcessableText(
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): string {
    // Twitter content and YouTube transcripts are already plain text.
    return this.isTwitterBookmark(bookmark) || this.isYouTubeBookmark(bookmark)
      ? (content.content ?? "")
      : this.chunkingService.stripHtml(content.content ?? "");
  }

  private buildSearchDocument(
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): string {
    const cleanedText = this.chunkingService.stripHtml(content.content ?? "");
    const truncated = cleanedText.slice(0, 5000);

    const parts = [
      bookmark.title ?? "",
      bookmark.sourceUrl,
      bookmark.cosmicBriefSummary ?? "",
      bookmark.cosmicTags?.join(" ") ?? "",
      truncated,
    ];

    return parts.filter(Boolean).join("\n");
  }

  /**
   * `content` is the row the fetch phase persisted and handed down — it
   * carries the id the chunks hang off. This used to re-read it from the
   * database first, which was a query for something already in hand.
   */
  private async chunkContent(
    content: ScrapedUrlContents
  ): Promise<ChunkingResult> {
    const chunks = this.chunkingService.chunkHtml(content.content ?? "");

    // Idempotent, because a phase has to be retryable: a reprocess or a
    // redelivered queue message would otherwise append a second full set of
    // chunks and double every semantic-search hit for this bookmark.
    await this.contentChunkRepository.deleteByScrapedContentId(content.id);

    if (chunks.length === 0) {
      return { textChunkIds: [], chunkTexts: [] };
    }

    const textChunkIds: string[] = [];
    for (const chunk of chunks) {
      const textChunk = await this.contentChunkRepository.createTextChunk({
        scrapedContentId: content.id,
        content: chunk.content,
        index: chunk.index,
        size: chunk.size,
        startPosition: chunk.startPosition,
        endPosition: chunk.endPosition,
      });
      textChunkIds.push(textChunk.id);
    }

    return {
      textChunkIds,
      chunkTexts: chunks.map((c) => c.content),
    };
  }

  private async embedChunks(
    chunkingResult: ChunkingResult,
    phaseReporter: BookmarkProcessingPhaseReporter
  ): Promise<void> {
    if (chunkingResult.chunkTexts.length === 0) return;

    const embeddings = await phaseReporter.trackTurn(
      "Generate chunk embeddings",
      this.embeddingService.getModelId(),
      async () => this.embeddingService.embedTextsWithUsage(chunkingResult.chunkTexts)
    );

    for (let i = 0; i < chunkingResult.textChunkIds.length; i++) {
      await this.contentChunkRepository.updateTextChunkEmbedding(
        chunkingResult.textChunkIds[i],
        embeddings[i]
      );
    }
  }

  private async processImages(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents,
    phaseReporter: BookmarkProcessingPhaseReporter
  ): Promise<BookmarkImage[]> {
    const images: BookmarkImage[] = [];

    if (!content.images || content.images.length === 0) {
      return images;
    }

    try {
      const relevantImages = await phaseReporter.trackTurn(
        "Select relevant images",
        BOOKMARK_MODEL_IDS.small,
        async () =>
          this.ai.generateObjectWithUsage({
            sessionID: session.sessionID,
            modelId: BOOKMARK_MODEL_IDS.small,
            prompt: FILTER_IMAGES_PROMPT.replace(
              "{{CONTENT}}",
              content.content ?? ""
            ),
            schema: z.object({
              images: z
                .array(
                  z.object({
                    url: z.string().describe("The image URL"),
                    title: z.string().describe("The image title"),
                    description: z.string().describe("The image description"),
                  })
                )
                .describe("The array of image URLs"),
            }),
          })
      );

      const imageProcessingPromises = relevantImages.images.map(
        async (image, index) => {
          try {
            // Skip relative/invalid URLs — got retries these indefinitely and blocks the queue
            let parsedUrl: URL;
            try {
              parsedUrl = new URL(image.url);
            } catch {
              return null;
            }
            if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
              return null;
            }

            const response = await this.httpClient.fetch(image.url);
            if (!response.ok) {
              throw new Error(
                `Failed to download image: ${response.statusText}`
              );
            }

            const imageBuffer = await response.arrayBuffer();
            const imageByteArray = Buffer.from(imageBuffer);
            const mimeType =
              response.headers.get("content-type") || "image/jpeg";
            const imageSize = imageByteArray.length;

            await this.contentChunkRepository.createImageChunk({
              scrapedContentId: content.id,
              imageData: imageByteArray,
              mimeType: mimeType,
              altText: image.title,
              originalUrl: image.url,
              index: index,
              size: imageSize,
              startPosition: 0,
              endPosition: imageSize,
            });

            return {
              url: image.url,
              title: image.title,
              description: image.description,
            };
          } catch (error) {
            console.error(`Failed to process image ${image.url}:`, error);
            return null;
          }
        }
      );

      const processedImages = await Promise.all(imageProcessingPromises);
      images.push(...processedImages.filter((img) => img !== null));
    } catch (error) {
      console.error("Failed to process images:", error);
      throw error;
    }
    return images;
  }
}
