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
  BookmarkProcessingPhaseReporter,
  BookmarkProcessingReporter,
} from "./bookmark-processing-reporter.service";

export interface BookmarkProcessorService {
  process(id: string, userId: string): Promise<void>;
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

  async process(id: string, userId: string): Promise<void> {
    const existingBookmark = await this.bookmarkService.findByIdAndUser(
      id,
      userId
    );
    if (!existingBookmark) {
      throw new Error(`Bookmark not found: ${id}`);
    }

    let bookmark = existingBookmark;
    const isPrivateLink = bookmark.isPrivateLink;
    const content = isPrivateLink
      ? null
      : await this.bookmarkService.getScrapedUrlContent(bookmark.id);
    if (!isPrivateLink && !content) {
      throw new Error(`Scraped url content not found: ${bookmark.id}`);
    }

    // Update processing status to 'processing'
    bookmark = await this.bookmarkService.updateProcessingStatus(
      bookmark.id,
      "processing"
    );

    const reporter = new BookmarkProcessingReporter(
      this.bookmarkProcessingRepository
    );
    await reporter.startRun(bookmark.id, userId);

    const startedTasks: Promise<unknown>[] = [];

    try {
      const session = await this.ai.newSession(bookmark.id);

      if (isPrivateLink) {
        bookmark = await this.processPrivateLink(session, bookmark, reporter);
        bookmark = await reporter.trackPhase(
          "finalization",
          "Finalize private link",
          async () =>
            this.bookmarkService.updateProcessingStatus(
              bookmark.id,
              "completed"
            )
        );
        await reporter.completeRun();
        return;
      }

      const scrapedContent = content!;

      // Start independent AI tasks in parallel to minimize total processing time
      const summaryPromise = reporter.trackPhase(
        "summarization",
        "Summarize content",
        (phaseReporter) =>
          this.generateSummary(session, bookmark, scrapedContent, phaseReporter)
      );
      const briefSummaryPromise = reporter.trackPhase(
        "brief_summary",
        "Generate brief summary",
        (phaseReporter) =>
          this.generateBriefSummary(
            session,
            bookmark,
            scrapedContent,
            phaseReporter
          )
      );
      const metadataPromise = reporter.trackPhase(
        "tags",
        "Generate tags",
        (phaseReporter) =>
          this.generateMetadata(session, bookmark, scrapedContent, phaseReporter)
      );
      const imagesPromise = reporter.trackPhase(
        "images",
        "Process images",
        (phaseReporter) =>
          this.isTwitterBookmark(bookmark)
            ? Promise.resolve(this.promoteTweetImages(scrapedContent))
            : this.processImages(session, bookmark, scrapedContent, phaseReporter)
      );
      const chunkingPromise = reporter.trackPhase(
        "chunking",
        "Chunk content",
        () => this.chunkContent(bookmark, scrapedContent)
      );
      const embeddingPromise = chunkingPromise.then((chunkingResult) =>
        reporter.trackPhase("embedding", "Embed content chunks", (phaseReporter) =>
          this.embedChunks(chunkingResult, phaseReporter)
        )
      );
      startedTasks.push(
        summaryPromise,
        briefSummaryPromise,
        metadataPromise,
        imagesPromise,
        chunkingPromise,
        embeddingPromise
      );

      // Categorization requires summary and tags, so we wait for those first
      const [summary, briefSummary, tags] = await Promise.all([
        summaryPromise,
        briefSummaryPromise,
        metadataPromise,
      ]);

      bookmark.cosmicSummary = summary;
      bookmark.cosmicBriefSummary = briefSummary;
      bookmark.cosmicTags = tags;

      // Categorize based on the generated summary and tags
      const categorization = await reporter.trackPhase(
        "categorization",
        "Categorize bookmark",
        (phaseReporter) =>
          this.categorizerService.categorize(
            session,
            bookmark,
            scrapedContent,
            phaseReporter
          )
      );
      bookmark.collectionId = categorization.categoryId;

      // Wait for images and embeddings to finish
      const images = await imagesPromise;
      bookmark.cosmicImages = images;
      await embeddingPromise;

      bookmark = await reporter.trackPhase(
        "finalization",
        "Finalize bookmark",
        async () => {
          // Final construction of search document
          const searchDocument = this.buildSearchDocument(
            bookmark,
            scrapedContent
          );
          bookmark.searchDocument = searchDocument;

          // Batch update the bookmark with all AI-generated content in one DB call
          bookmark = await this.bookmarkService.update(bookmark.id, bookmark);

          // Update processing status to 'completed'
          return this.bookmarkService.updateProcessingStatus(
            bookmark.id,
            "completed"
          );
        }
      );
      await reporter.completeRun();
    } catch (error) {
      // If one parallel task fails, make sure every task that was already
      // started has settled before rethrowing. Otherwise later rejections from
      // the still-running tasks can surface as unhandled promise rejections in
      // Node/Jest and fail CI after the expected error has already been caught.
      await Promise.allSettled(startedTasks);

      // Update processing status to 'failed'
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      bookmark = await this.bookmarkService.updateProcessingStatus(
        bookmark.id,
        "failed",
        errorMessage
      );
      await reporter.failRun(errorMessage);
      throw error;
    }
  }

  private isYouTubeBookmark(bookmark: Bookmark): boolean {
    return bookmark.metadata?.openGraph?.site_name === "YouTube";
  }

  private isTwitterBookmark(bookmark: Bookmark): boolean {
    return bookmark.metadata?.openGraph?.site_name === "X (formerly Twitter)";
  }

  private async processPrivateLink(
    session: Session,
    bookmark: Bookmark,
    reporter: BookmarkProcessingReporter
  ): Promise<Bookmark> {
    const context = bookmark.metadata?.privateLink;
    const userDescription =
      context?.userDescription ||
      bookmark.cosmicBriefSummary ||
      bookmark.metadata?.openGraph?.description ||
      "";

    try {
      const enrichment = await reporter.trackPhase(
        "private_link_enrichment",
        "Enrich private link",
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

      const tags = this.normalizeTags(enrichment.tags);
      const enrichedBookmark: Bookmark = {
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

      const syntheticContent =
        this.buildPrivateLinkSyntheticContent(enrichedBookmark);
      const categorization = await reporter.trackPhase(
        "categorization",
        "Categorize private link",
        (phaseReporter) =>
          this.categorizerService.categorize(
            session,
            enrichedBookmark,
            syntheticContent,
            phaseReporter
          )
      );
      enrichedBookmark.collectionId = categorization.categoryId;

      return this.bookmarkService.update(bookmark.id, enrichedBookmark);
    } catch (error) {
      throw error;
    }
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

  private async chunkContent(
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<ChunkingResult> {
    const scrapedContent =
      await this.bookmarkService.getScrapedUrlContent(bookmark.id);
    if (!scrapedContent) {
      throw new Error(`Scraped content not found for bookmark ${bookmark.id}`);
    }

    const chunks = this.chunkingService.chunkHtml(content.content ?? "");

    if (chunks.length === 0) {
      return { textChunkIds: [], chunkTexts: [] };
    }

    const textChunkIds: string[] = [];
    for (const chunk of chunks) {
      const textChunk = await this.contentChunkRepository.createTextChunk({
        scrapedContentId: scrapedContent.id,
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
