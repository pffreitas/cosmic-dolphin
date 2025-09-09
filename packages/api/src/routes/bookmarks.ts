import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { 
  CreateBookmarkRequest, 
  CreateBookmarkResponse, 
  GetBookmarksQuery,
  GetBookmarksResponse,
  ServiceContainer 
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment";

export default async function bookmarkRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const { createServiceContainer } = await import("@cosmic-dolphin/shared");
  const services: ServiceContainer = createServiceContainer(supabase);

  fastify.post<{
    Body: CreateBookmarkRequest;
    Reply: CreateBookmarkResponse | { error: string };
  }>(
    "/bookmarks",
    async (
      request: FastifyRequest<{ Body: CreateBookmarkRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const { source_url, collection_id, user_id } = request.body;

        if (!source_url) {
          return reply.status(400).send({ error: "source_url is required" });
        }

        if (!user_id) {
          return reply.status(400).send({ error: "user_id is required" });
        }

        if (!services.webScraping.isValidUrl(source_url)) {
          return reply.status(400).send({ error: "Invalid URL format" });
        }

        const existingBookmark = await services.bookmark.findByUserAndUrl(user_id, source_url);
        if (existingBookmark) {
          return reply
            .status(409)
            .send({ error: "Bookmark already exists for this URL" });
        }

        if (collection_id) {
          const collection = await services.collection.findByIdAndUser(collection_id, user_id);
          if (!collection) {
            return reply
              .status(400)
              .send({
                error: "Invalid collection_id or collection does not belong to user",
              });
          }
        }

        const { content, contentType } = await services.webScraping.validateAndFetchUrl(source_url);
        const ogData = services.webScraping.extractOpenGraphMetadata(content);
        const metadata = services.webScraping.createBookmarkMetadata(ogData, contentType, content);

        const bookmark = await services.bookmark.create({
          sourceUrl: source_url,
          title: metadata.title,
          description: metadata.description,
          metadata,
          collectionId: collection_id,
          userId: user_id,
          isArchived: false,
          isFavorite: false,
          tags: [],
        });

        try {
          await services.queue.sendBookmarkProcessingMessage(
            bookmark.id,
            source_url,
            user_id,
            collection_id
          );
        } catch (queueError) {
          fastify.log.error({ queueError }, "Queue post error");
        }

        return reply.status(201).send({
          bookmark,
          message: "Bookmark created successfully",
        });
      } catch (error) {
        fastify.log.error({ error }, "Bookmark creation error");

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
    Querystring: GetBookmarksQuery;
    Reply: GetBookmarksResponse | { error: string };
  }>("/bookmarks", async (request, reply) => {
    try {
      const { user_id, collection_id, limit = 50, offset = 0 } = request.query;

      if (!user_id) {
        return reply.status(400).send({ error: "user_id is required" });
      }

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
}