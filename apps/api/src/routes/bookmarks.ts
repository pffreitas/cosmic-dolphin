import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  CreateBookmarkRequest,
  CreateBookmarkResponse,
  GetBookmarksQuery,
  GetBookmarksResponse,
  SearchBookmarksQuery,
  SearchBookmarksResponse,
  ShareBookmarkResponse,
  ServiceContainer,
  createServiceContainer,
  Bookmark,
  createDatabase,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

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
    { preHandler: authMiddleware },
    async (
      request: FastifyRequest<{ Body: Omit<CreateBookmarkRequest, "user_id"> }>,
      reply: FastifyReply
    ) => {
      try {
        const { source_url } = request.body as Omit<
          CreateBookmarkRequest,
          "user_id"
        >;
        const user_id = request.userId!;

        fastify.log.info({ source_url, user_id }, "Create bookmark request");

        if (!source_url) {
          return reply.status(400).send({ error: "source_url is required" });
        }

        if (!services.webScraping.isValidUrl(source_url)) {
          return reply.status(400).send({ error: "Invalid URL format" });
        }

        const existingBookmark = await services.bookmark.findByUserAndUrl(
          user_id,
          source_url
        );
        if (existingBookmark) {
          return reply.status(201).send({
            bookmark: existingBookmark,
            message: "Bookmark created successfully",
          });
        }

        const bookmark = await services.bookmark.create(source_url, user_id);

        try {
          await services.queue.sendBookmarkProcessingMessage(
            bookmark.id,
            user_id
          );
        } catch (queueError) {
          console.log("queueError", queueError);
          fastify.log.error({ queueError }, "Queue post error");
        }

        return reply.status(201).send({
          bookmark,
          message: "Bookmark created successfully",
        });
      } catch (error) {
        fastify.log.error({ error }, "Bookmark creation error");
        fastify.log.error(error);

        if (error instanceof Error) {
          if (
            error.message.includes("timeout") ||
            error.message.includes("Request timeout")
          ) {
            return reply.status(408).send({ error: "URL request timeout" });
          }

          if (error.message.includes("HTTP")) {
            return reply
              .status(422)
              .send({ error: `URL not accessible: ${error.message}` });
          }

          if (error.message.includes("Unsupported content type")) {
            return reply.status(422).send({ error: error.message });
          }
        }

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
      } = request.query as Omit<GetBookmarksQuery, "user_id">;
      const user_id = request.userId!;

      fastify.log.info(
        { collection_id, limit, offset, user_id },
        "Get bookmarks request"
      );

      const bookmarks = await services.bookmark.findByUser(user_id, {
        collectionId: collection_id,
        limit,
        offset,
        includeArchived: false,
      });

      return reply.send({ bookmarks });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      fastify.log.error({ errorMessage, errorStack }, "Get bookmarks error");
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

  // Preview endpoint - fetches OpenGraph metadata for a URL without saving
  fastify.post<{
    Body: { url: string };
    Reply:
      | {
          metadata: {
            title?: string;
            description?: string;
            image?: string;
            favicon?: string;
            siteName?: string;
            url?: string;
          };
        }
      | { error: string };
  }>(
    "/bookmarks/preview",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { url } = request.body;

        fastify.log.info({ url }, "Preview URL request");

        if (!url) {
          return reply.status(400).send({ error: "url is required" });
        }

        if (!services.webScraping.isValidUrl(url)) {
          return reply.status(400).send({ error: "Invalid URL format" });
        }

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
        });
      } catch (error) {
        fastify.log.error({ error }, "Preview URL error");

        if (error instanceof Error) {
          if (
            error.message.includes("timeout") ||
            error.message.includes("Request timeout")
          ) {
            return reply.status(408).send({ error: "URL request timeout" });
          }

          if (error.message.includes("HTTP")) {
            return reply
              .status(422)
              .send({ error: `URL not accessible: ${error.message}` });
          }

          if (error.message.includes("Unsupported content type")) {
            return reply.status(422).send({ error: error.message });
          }
        }

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

        const bookmark = await services.bookmark.findByIdAndUser(id, user_id);

        if (!bookmark) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        const isLikedByCurrentUser =
          await services.bookmarkLike.isLikedByUser(user_id, id);

        return reply.send({ ...bookmark, isLikedByCurrentUser });
      } catch (error) {
        fastify.log.error({ error }, "Get bookmark by ID error");
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

  fastify.get<{
    Params: { slug: string };
    Reply: Bookmark | { error: string };
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

        return reply.send(publicBookmark as Bookmark);
      } catch (error) {
        fastify.log.error({ error }, "Get shared bookmark error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
