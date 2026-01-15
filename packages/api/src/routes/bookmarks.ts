import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  CreateBookmarkRequest,
  CreateBookmarkResponse,
  GetBookmarksQuery,
  GetBookmarksResponse,
  SearchBookmarksQuery,
  SearchBookmarksResponse,
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
      fastify.log.error({ error }, "Get bookmarks error");
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

        return reply.send(bookmark);
      } catch (error) {
        fastify.log.error({ error }, "Get bookmark by ID error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
