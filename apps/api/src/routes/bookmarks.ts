import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  BookmarkKeyset,
  BookmarkLibraryCounts,
  BookmarkScope,
  BookmarkSort,
  CreateBookmarkRequest,
  CreateBookmarkResponse,
  GetBookmarksQuery,
  GetBookmarksResponse,
  SearchBookmarksQuery,
  SearchBookmarksResponse,
  ShareBookmarkResponse,
  PreviewResponse,
  ServiceContainer,
  createServiceContainer,
  Bookmark,
  BookmarkProcessingTimeline,
  createDatabase,
  normalizeUrl,
  BOOKMARK_PROCESSING_PHASES,
  type BookmarkProcessingPhase,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { RATE_LIMITS, rateLimited } from "../plugins/rate-limit";
import { firstZodMessage, refileBookmarkSchema } from "./collections";

export const BOOKMARK_SORTS: BookmarkSort[] = [
  "newest",
  "oldest",
  "recently_read",
  "longest_unread",
];

export function isBookmarkSort(value: string): value is BookmarkSort {
  return (BOOKMARK_SORTS as string[]).includes(value);
}

/** The Library rail's rows, as a query — see `BookmarkScope`. */
export const BOOKMARK_SCOPES: BookmarkScope[] = ["all", "inbox", "archive"];

export function isBookmarkScope(value: string): value is BookmarkScope {
  return (BOOKMARK_SCOPES as string[]).includes(value);
}

/**
 * The library cursor.
 *
 * Opaque to the client on purpose — it is a keyset, and a client that learns
 * to read it will start constructing them. It carries the ordering it was
 * produced under, so a cursor pasted into a request with a different `sort` is
 * a 400 rather than a page of rows in an order nobody asked for.
 */
interface BookmarkCursorPayload {
  s: BookmarkSort;
  c: string;
  r: string | null;
  i: string;
}

export function encodeBookmarkCursor(
  sort: BookmarkSort,
  bookmark: { id: string; createdAt: Date; readAt?: Date | null }
): string {
  const payload: BookmarkCursorPayload = {
    s: sort,
    c: new Date(bookmark.createdAt).toISOString(),
    r: bookmark.readAt ? new Date(bookmark.readAt).toISOString() : null,
    i: bookmark.id,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type DecodeCursorResult =
  | { ok: true; cursor: BookmarkKeyset }
  | { ok: false; error: string };

export function decodeBookmarkCursor(
  raw: string,
  sort: BookmarkSort
): DecodeCursorResult {
  let payload: BookmarkCursorPayload;

  try {
    payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid cursor" };
  }

  if (!payload || typeof payload !== "object" || typeof payload.i !== "string") {
    return { ok: false, error: "Invalid cursor" };
  }

  if (payload.s !== sort) {
    return {
      ok: false,
      error: "Cursor does not belong to this sort. Start the list again.",
    };
  }

  const createdAt = new Date(payload.c);
  if (Number.isNaN(createdAt.getTime())) {
    return { ok: false, error: "Invalid cursor" };
  }

  const readAt = payload.r === null ? null : new Date(payload.r);
  if (readAt !== null && Number.isNaN(readAt.getTime())) {
    return { ok: false, error: "Invalid cursor" };
  }

  return { ok: true, cursor: { createdAt, readAt, id: payload.i } };
}

/**
 * Title, tags, archived. Not `collectionId` — moving a bookmark has its own
 * endpoint because it has to write `filing_source` in the same statement.
 */
export const updateBookmarkSchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be blank").optional(),
    isArchived: z.boolean().optional(),
    tags: z
      .array(z.string().trim().min(1, "a tag cannot be blank"))
      .max(50, "at most 50 tags")
      .optional(),
  })
  .refine(
    (body) =>
      body.title !== undefined ||
      body.isArchived !== undefined ||
      body.tags !== undefined,
    { message: "nothing to update" }
  );

export type CreateBookmarkValidationResult =
  | { ok: true }
  | { ok: false; status: 400; error: string };

export function validateCreateBookmarkBody(
  body: Partial<Omit<CreateBookmarkRequest, "user_id">>,
  isValidUrl: (url: string) => boolean
): CreateBookmarkValidationResult {
  if (!body.source_url) {
    return { ok: false, status: 400, error: "source_url is required" };
  }

  if (!isValidUrl(body.source_url)) {
    return { ok: false, status: 400, error: "Invalid URL format" };
  }

  if (body.is_private_link && !body.description?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "description is required for private links",
    };
  }

  return { ok: true };
}

type BookmarkTimelineServices = Pick<
  ServiceContainer,
  "bookmark" | "bookmarkProcessing"
>;

type BookmarkQueueServices = Pick<
  ServiceContainer,
  "bookmark" | "queue" | "processingBudget"
>;

export interface QueueBookmarkResult {
  bookmark: Bookmark;
  /** False when the daily processing budget refused the enqueue. */
  queued: boolean;
  /** What to tell the user. Empty when the enqueue was unremarkable. */
  message?: string;
}

/**
 * Enqueue a bookmark for processing — unless today's budget says otherwise.
 *
 * The budget is checked **here**, before the message is sent, because a job
 * that will be refused should never enter the queue
 * (docs/functional-spec/03-ai-pipeline.md § Cost). Over budget the save still
 * stands: the row lands `idle`, which is a legitimate resting state and not a
 * failure, and the client offers **Summarise now** on it.
 */
export async function queueBookmarkForProcessing(
  services: BookmarkQueueServices,
  bookmark: Bookmark,
  userId: string,
  onQueueError?: (error: unknown) => void
): Promise<QueueBookmarkResult> {
  const budget = await services.processingBudget.check(userId);
  if (!budget.withinBudget) {
    const idleBookmark = await services.bookmark.updateProcessingStatus(
      bookmark.id,
      "idle"
    );
    return {
      bookmark: idleBookmark,
      queued: false,
      message:
        "Saved. Today's processing budget is spent — use Summarise now when you want this one processed.",
    };
  }

  const processingBookmark = await services.bookmark.updateProcessingStatus(
    bookmark.id,
    "processing"
  );

  try {
    await services.queue.sendBookmarkProcessingMessage(bookmark.id, userId);
  } catch (queueError) {
    onQueueError?.(queueError);
    return {
      bookmark: await services.bookmark.updateProcessingStatus(
        bookmark.id,
        "failed",
        "Failed to enqueue bookmark processing"
      ),
      queued: false,
    };
  }

  return { bookmark: processingBookmark, queued: true };
}

export async function buildBookmarkProcessingTimelineResponse(
  services: BookmarkTimelineServices,
  bookmarkId: string,
  userId: string
): Promise<
  | { statusCode?: undefined; body: BookmarkProcessingTimeline }
  | { statusCode: 404; body: { error: string } }
> {
  const result = await services.bookmark.findByIdAndUserWithLikeStatus(
    bookmarkId,
    userId
  );

  if (!result) {
    return {
      statusCode: 404,
      body: { error: "Bookmark not found" },
    };
  }

  const timeline = await services.bookmarkProcessing.findLatestTimeline(
    bookmarkId,
    userId
  );
  const bookmark = {
    ...result.bookmark,
    isLikedByCurrentUser: result.isLikedByCurrentUser,
  };
  const hasRunningTimeline =
    timeline?.run.status === "running" ||
    timeline?.events.some((event) => event.status === "running") === true;

  return {
    body: {
      bookmark,
      run: timeline?.run,
      events: timeline?.events ?? [],
      pollAfterMs:
        bookmark.processingStatus === "processing" || hasRunningTimeline
          ? 2000
          : 0,
    },
  };
}

type BookmarkRefileServices = Pick<ServiceContainer, "bookmark" | "collection">;

/**
 * The override. A person has said where this bookmark belongs, and that answer
 * outlives every future run of the pipeline.
 *
 * The whole point is the single call to `refileByUser`: it writes
 * `collection_id` and `filing_source = 'user'` in one statement
 * (`BookmarkRepository.updateUserFiling`), so there is no instant at which the
 * bookmark has moved but is still marked as the AI's to move again. A refile
 * the next run can undo is worse than no refile at all
 * (docs/functional-spec/08-api-surface.md § Collections).
 *
 * `refileByUser` is also scoped to `userId` in SQL, which is what makes the
 * bookmark's ownership check a 404 rather than a separate read.
 */
export async function refileBookmarkForUser(
  services: BookmarkRefileServices,
  bookmarkId: string,
  userId: string,
  collectionId: string | null
): Promise<
  | { statusCode?: undefined; body: Bookmark }
  | { statusCode: 404; body: { error: string } }
> {
  if (collectionId !== null) {
    const collection = await services.collection.findByIdAndUser(
      collectionId,
      userId
    );
    if (!collection) {
      return { statusCode: 404, body: { error: "Collection not found" } };
    }
  }

  const bookmark = await services.bookmark.refileByUser(
    bookmarkId,
    userId,
    collectionId
  );

  if (!bookmark) {
    return { statusCode: 404, body: { error: "Bookmark not found" } };
  }

  return { body: bookmark };
}

export default async function bookmarkRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  fastify.post<{
    Body: Omit<CreateBookmarkRequest, "user_id">;
    Reply: CreateBookmarkResponse | { error: string };
  }>(
    "/bookmarks",
    {
      preHandler: authMiddleware,
      // 100 saves a day, per user. 429 with `Retry-After` — the client keeps
      // the URL in the field and shows the wait.
      config: rateLimited(RATE_LIMITS.saves),
    },
    async (
      request: FastifyRequest<{ Body: Omit<CreateBookmarkRequest, "user_id"> }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          source_url,
          is_private_link,
          title,
          description,
          tags,
          collection_id,
        } = request.body as Omit<CreateBookmarkRequest, "user_id">;
        const user_id = request.userId!;

        fastify.log.info({ source_url, user_id, is_private_link }, "Create bookmark request");

        const validation = validateCreateBookmarkBody(
          request.body,
          services.webScraping.isValidUrl.bind(services.webScraping)
        );
        if (!validation.ok) {
          return reply.status(validation.status).send({
            error: validation.error,
          });
        }

        // Normalise once, here, and key everything below off the result. The
        // dedupe check, the insert and the queue message all have to agree on
        // one string or the unique index and the "already saved" answer drift
        // apart.
        const { url: normalizedUrl, originalUrl } = normalizeUrl(source_url);

        const existingBookmark = await services.bookmark.findByUserAndUrl(
          user_id,
          normalizedUrl
        );
        if (existingBookmark) {
          if (is_private_link) {
            const bookmark = await services.bookmark.convertToPrivateLink(
              existingBookmark,
              {
                title,
                description,
                tags,
                collectionId: collection_id,
                originalUrl,
              }
            );
            const queued = await queueBookmarkForProcessing(
              services,
              bookmark,
              user_id,
              (queueError) => {
                fastify.log.error({ queueError }, "Queue post error");
              }
            );
            return reply.status(201).send({
              bookmark: queued.bookmark,
              message: queued.message ?? "Private link saved successfully",
            });
          }

          // Pasting the same link twice is not an error. Hand back the row the
          // user already has and let the client toast "Already in your
          // library" with a link to it — no 409, and nothing re-queued.
          return reply.status(200).send({
            bookmark: existingBookmark,
            alreadySaved: true,
            message: "Already in your library",
          });
        }

        if (is_private_link) {
          const bookmark = await services.bookmark.createPrivateLink(
            normalizedUrl,
            user_id,
            {
              title,
              description,
              tags,
              collectionId: collection_id,
              originalUrl,
            }
          );
          const queued = await queueBookmarkForProcessing(
            services,
            bookmark,
            user_id,
            (queueError) => {
              fastify.log.error({ queueError }, "Queue post error");
            }
          );
          return reply.status(201).send({
            bookmark: queued.bookmark,
            message: queued.message ?? "Private link saved successfully",
          });
        }

        // Two writes and a queue message. No fetch, no extraction, no model
        // call — every one of those happens in the worker, on a row the user
        // already has on screen. See docs/functional-spec/02-capture.md.
        const bookmark = await services.bookmark.create(normalizedUrl, user_id, {
          originalUrl,
          collectionId: collection_id,
        });

        const queued = await queueBookmarkForProcessing(
          services,
          bookmark,
          user_id,
          (queueError) => {
            fastify.log.error({ queueError }, "Queue post error");
          }
        );

        return reply.status(201).send({
          bookmark: queued.bookmark,
          message: queued.message ?? "Bookmark created successfully",
        });
      } catch (error) {
        // The 408 and 422 branches that used to live here mapped scraping
        // failures — a timeout, a bad content type, an unreadable page. This
        // handler no longer scrapes, so an unreachable host is now a failed
        // `fetch` phase on a bookmark the user already has, not a rejected
        // save. See docs/functional-spec/02-capture.md § Failure.
        fastify.log.error({ error }, "Bookmark creation error");

        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{
    Querystring: Omit<GetBookmarksQuery, "user_id">;
    Reply: GetBookmarksResponse | { error: string };
  }>("/bookmarks", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const {
        collection_id,
        limit = 50,
        offset = 0,
        read_status = "all",
        scope = "all",
        sort = "newest",
        cursor,
      } = request.query as Omit<GetBookmarksQuery, "user_id">;
      const user_id = request.userId!;

      fastify.log.info(
        { collection_id, limit, offset, read_status, scope, sort, user_id },
        "Get bookmarks request"
      );

      if (!["all", "unread", "read"].includes(read_status)) {
        return reply.status(400).send({ error: "Invalid read_status" });
      }

      if (!isBookmarkScope(scope)) {
        return reply.status(400).send({ error: "Invalid scope" });
      }

      if (!isBookmarkSort(sort)) {
        return reply.status(400).send({ error: "Invalid sort" });
      }

      let keyset: BookmarkKeyset | null = null;
      if (cursor) {
        const decoded = decodeBookmarkCursor(cursor, sort);
        if (!decoded.ok) {
          return reply.status(400).send({ error: decoded.error });
        }
        keyset = decoded.cursor;
      }

      // One row past the page, then dropped. Without it "is there more?" is a
      // guess, and a `nextCursor` on a full last page hands the client an
      // empty page to render before it learns the list has ended.
      const rows = await services.bookmark.findByUser(user_id, {
        collectionId: collection_id,
        limit: limit + 1,
        offset,
        includeArchived: false,
        readStatus: read_status,
        scope,
        sort,
        cursor: keyset,
      });

      const hasMore = rows.length > limit;
      const bookmarks = hasMore ? rows.slice(0, limit) : rows;
      const last = bookmarks[bookmarks.length - 1];

      return reply.send({
        bookmarks,
        nextCursor:
          hasMore && last ? encodeBookmarkCursor(sort, last) : undefined,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      fastify.log.error({ errorMessage, errorStack }, "Get bookmarks error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // The Library rail's counts. A static segment, so it has to be reachable
  // ahead of `/bookmarks/:id` — find-my-way prefers static over parametric, so
  // registration order here is not what saves it, but the two are kept apart
  // anyway for the next person reading the file.
  fastify.get<{
    Reply: BookmarkLibraryCounts | { error: string };
  }>("/bookmarks/counts", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const counts = await services.bookmark.countLibrary(request.userId!);
      return reply.send(counts);
    } catch (error) {
      fastify.log.error({ error }, "Get bookmark counts error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.get<{
    Querystring: { limit?: number; offset?: number };
    Reply: GetBookmarksResponse | { error: string };
  }>("/bookmarks/feed", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { limit = 50, offset = 0 } = request.query;
      const user_id = request.userId!;

      fastify.log.info({ limit, offset, user_id }, "Get bookmark feed request");

      const bookmarks = await services.bookmark.findFeed(user_id, {
        limit,
        offset,
      });

      return reply.send({ bookmarks });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      fastify.log.error({ errorMessage, errorStack }, "Get bookmark feed error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.get<{
    Querystring: Omit<SearchBookmarksQuery, "user_id">;
    Reply: SearchBookmarksResponse | { error: string };
  }>(
    "/bookmarks/search",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const {
          query,
          limit = 50,
          offset = 0,
        } = request.query as Omit<SearchBookmarksQuery, "user_id">;
        const user_id = request.userId!;

        fastify.log.info(
          { query, limit, offset, user_id },
          "Search bookmarks request"
        );

        if (!query || query.trim() === "") {
          return reply.status(400).send({ error: "Search query is required" });
        }

        const bookmarks = await services.bookmark.searchByQuickAccess(
          user_id,
          query,
          {
            limit,
            offset,
            includeArchived: false,
          }
        );

        return reply.send({ bookmarks });
      } catch (error) {
        fastify.log.error({ error }, "Search bookmarks error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Preview endpoint - fetches OpenGraph metadata for a URL without saving.
  // On scraping failure (private/authenticated links), returns partial metadata
  // derived from the URL structure. User-provided description is collected only
  // during private-link save, then enriched asynchronously after creation.
  fastify.post<{
    Body: { url: string };
    Reply: PreviewResponse | { error: string };
  }>(
    "/bookmarks/preview",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { url } = request.body;

      fastify.log.info({ url }, "Preview URL request");

      if (!url) {
        return reply.status(400).send({ error: "url is required" });
      }

      if (!services.webScraping.isValidUrl(url)) {
        return reply.status(400).send({ error: "Invalid URL format" });
      }

      try {
        const scrapedContent = await services.webScraping.scrape(url);
        const openGraph = scrapedContent.metadata?.openGraph;

        return reply.send({
          metadata: {
            title: openGraph?.title || scrapedContent.title,
            description: openGraph?.description,
            image: openGraph?.image,
            favicon: openGraph?.favicon,
            siteName: openGraph?.site_name,
            url: openGraph?.url || url,
          },
          scrapable: true,
        });
      } catch (error) {
        fastify.log.info({ error, url }, "URL not scrapable, extracting metadata from URL structure");

        const partialMetadata = services.webScraping.extractMetadataFromUrl(url);

        return reply.send({
          metadata: partialMetadata,
          scrapable: false,
        });
      }
    }
  );

  fastify.get<{
    Params: { id: string };
    Reply: BookmarkProcessingTimeline | { error: string };
  }>(
    "/bookmarks/:id/processing-timeline",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const result = await buildBookmarkProcessingTimelineResponse(
          services,
          id,
          user_id
        );

        if (result.statusCode) {
          return reply.status(result.statusCode).send(result.body);
        }

        return reply.send(result.body);
      } catch (error) {
        fastify.log.error({ error }, "Get bookmark processing timeline error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // A manual Retry, and the Summarise now action on a bookmark the daily
  // budget left idle. Both are the same thing: an explicit request to run the
  // pipeline again, appended to the timeline already on screen.
  fastify.post<{
    Params: { id: string };
    Body: { phase?: BookmarkProcessingPhase } | undefined;
    Reply: { bookmark: Bookmark; message: string } | { error: string };
  }>(
    "/bookmarks/:id/reprocess",
    {
      preHandler: authMiddleware,
      config: rateLimited(RATE_LIMITS.reprocess),
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;
        const phase = request.body?.phase;

        if (phase && !BOOKMARK_PROCESSING_PHASES.includes(phase)) {
          return reply.status(400).send({ error: `Unknown phase: ${phase}` });
        }

        const bookmark = await services.bookmark.findByIdAndUser(id, user_id);
        if (!bookmark) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        // Deliberately not budget-checked. The budget stops the pipeline
        // spending on its own; a person asking for one bookmark to be
        // processed is the escape hatch it exists to leave open. The
        // reprocess rate limit is what keeps a stuck client from abusing it.
        const processing = await services.bookmark.updateProcessingStatus(
          bookmark.id,
          "processing"
        );

        try {
          await services.queue.sendBookmarkProcessingMessage(
            bookmark.id,
            user_id,
            { phase, resume: true }
          );
        } catch (queueError) {
          fastify.log.error({ queueError }, "Reprocess queue post error");
          await services.bookmark.updateProcessingStatus(
            bookmark.id,
            "failed",
            "Failed to enqueue bookmark processing"
          );
          return reply
            .status(500)
            .send({ error: "Could not start reprocessing" });
        }

        return reply.status(202).send({
          bookmark: processing,
          message: phase
            ? `Retrying ${phase}`
            : "Reprocessing this bookmark",
        });
      } catch (error) {
        fastify.log.error({ error }, "Reprocess bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{
    Params: { id: string };
    Reply: Bookmark | { error: string };
  }>(
    "/bookmarks/:id",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const result = await services.bookmark.findByIdAndUserWithLikeStatus(
          id,
          user_id
        );

        if (!result) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        return reply.send({
          ...result.bookmark,
          isLikedByCurrentUser: result.isLikedByCurrentUser,
        });
      } catch (error) {
        fastify.log.error({ error }, "Get bookmark by ID error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Title, tags, archived. What the Library's bulk bar writes through for
  // **Archive** and **Add tag** — and the reason `tags` is the whole list
  // rather than a delta: the toast offers an undo for eight seconds, and an
  // undo that can only remove what it added cannot restore a tag the bulk
  // action happened to overwrite.
  fastify.patch<{
    Params: { id: string };
    Body: unknown;
    Reply: Bookmark | { error: string };
  }>("/bookmarks/:id", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { id } = request.params;
      const user_id = request.userId!;

      const parsed = updateBookmarkSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      // Ownership is a read first: `BookmarkRepository.update` is keyed on id
      // alone, so without this a valid id belonging to someone else would be
      // writable.
      const existing = await services.bookmark.findByIdAndUser(id, user_id);
      if (!existing) {
        return reply.status(404).send({ error: "Bookmark not found" });
      }

      const { title, isArchived, tags } = parsed.data;
      const bookmark = await services.bookmark.update(id, {
        ...(title !== undefined ? { title } : {}),
        ...(isArchived !== undefined ? { isArchived } : {}),
        ...(tags !== undefined ? { cosmicTags: tags } : {}),
      });

      return reply.send(bookmark);
    } catch (error) {
      fastify.log.error({ error }, "Update bookmark error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.delete<{
    Params: { id: string };
    Reply: { message: string } | { error: string };
  }>(
    "/bookmarks/:id",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        await services.bookmark.delete(id, user_id);

        return reply.send({ message: "Bookmark deleted successfully" });
      } catch (error) {
        if (error instanceof Error && error.message === "Bookmark not found") {
          return reply.status(404).send({ error: "Bookmark not found" });
        }
        fastify.log.error({ error }, "Delete bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Reply: Bookmark | { error: string };
  }>(
    "/bookmarks/:id/read",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const bookmark = await services.bookmark.markRead(id, user_id);

        return reply.send(bookmark);
      } catch (error) {
        if (error instanceof Error && error.message === "Bookmark not found") {
          return reply.status(404).send({ error: "Bookmark not found" });
        }
        fastify.log.error({ error }, "Mark bookmark read error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: Bookmark | { error: string };
  }>(
    "/bookmarks/:id/read",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const bookmark = await services.bookmark.markUnread(id, user_id);

        return reply.send(bookmark);
      } catch (error) {
        if (error instanceof Error && error.message === "Bookmark not found") {
          return reply.status(404).send({ error: "Bookmark not found" });
        }
        fastify.log.error({ error }, "Mark bookmark unread error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Reply: { likeCount: number; isLikedByCurrentUser: boolean } | { error: string };
  }>(
    "/bookmarks/:id/like",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const result = await services.bookmarkLike.like(user_id, id);

        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, "Like bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: { likeCount: number; isLikedByCurrentUser: boolean } | { error: string };
  }>(
    "/bookmarks/:id/like",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const result = await services.bookmarkLike.unlike(user_id, id);

        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, "Unlike bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Reply: ShareBookmarkResponse | { error: string };
  }>(
    "/bookmarks/:id/share",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const result = await services.bookmark.share(id, user_id);

        return reply.send(result);
      } catch (error) {
        if (error instanceof Error && error.message === "Bookmark not found") {
          return reply.status(404).send({ error: "Bookmark not found" });
        }
        fastify.log.error({ error }, "Share bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: ShareBookmarkResponse | { error: string };
  }>(
    "/bookmarks/:id/share",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const result = await services.bookmark.unshare(id, user_id);

        return reply.send(result);
      } catch (error) {
        if (error instanceof Error && error.message === "Bookmark not found") {
          return reply.status(404).send({ error: "Bookmark not found" });
        }
        fastify.log.error({ error }, "Unshare bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // Manual refile. Lives here, not in `collections.ts`, because it is addressed
  // as a bookmark — the resource-domain convention keys on the path.
  fastify.patch<{
    Params: { id: string };
    Body: unknown;
    Reply: Bookmark | { error: string };
  }>(
    "/bookmarks/:id/collection",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const parsed = refileBookmarkSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const result = await refileBookmarkForUser(
          services,
          id,
          user_id,
          parsed.data.collectionId
        );

        if (result.statusCode) {
          return reply.status(result.statusCode).send(result.body);
        }

        return reply.send(result.body);
      } catch (error) {
        fastify.log.error({ error }, "Refile bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{
    Params: { slug: string };
  }>(
    "/bookmarks/shared/:slug",
    async (request, reply) => {
      try {
        const { slug } = request.params;

        const bookmark = await services.bookmark.findByShareSlug(slug);

        if (!bookmark) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        const { quickAccess, searchDocument, userId, processingStatus, processingStartedAt, processingCompletedAt, processingError, ...publicBookmark } = bookmark;

        let sharedByUserName: string | undefined;
        try {
          const profile = await services.profile.findById(userId);
          if (profile) {
            sharedByUserName = profile.name || profile.email?.split("@")[0];
          }
        } catch {
          // Profile lookup is best-effort
        }

        return reply.send({ ...publicBookmark, sharedByUserName });
      } catch (error) {
        fastify.log.error(error, "Get shared bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
