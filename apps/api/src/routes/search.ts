import { FastifyInstance } from "fastify";
import {
  ServiceContainer,
  createServiceContainer,
  createDatabase,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

export default async function searchRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  fastify.get<{
    Querystring: { q: string; limit?: number };
  }>("/search", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { q, limit = 20 } = request.query;
      const userId = request.userId!;

      if (!q || q.trim() === "") {
        return reply.status(400).send({ error: "Search query is required" });
      }

      const results = await services.search.hybridSearch(userId, q, {
        limit,
      });

      const mapped = results.map((r) => ({
        bookmark: r.bookmark,
        score: r.score,
        matchedChunks: r.matchedChunks,
      }));

      return reply.send({ results: mapped });
    } catch (error) {
      fastify.log.error({ error }, "Hybrid search error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.post<{
    Body: { query: string };
  }>(
    "/search/ask",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { query } = request.body;
        const userId = request.userId!;

        if (!query || query.trim() === "") {
          return reply.status(400).send({ error: "Search query is required" });
        }

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": request.headers.origin || "*",
          "Access-Control-Allow-Credentials": "true",
        });

        const sendSSE = (event: string, data: any) => {
          reply.raw.write(`event: ${event}\n`);
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        await services.search.askWithContext(
          userId,
          query,
          (chunk: string) => {
            sendSSE("chunk", { text: chunk });
          },
          (results) => {
            const mapped = results.map((r) => ({
              bookmark: r.bookmark,
              score: r.score,
              matchedChunks: r.matchedChunks,
            }));
            sendSSE("results", { results: mapped });
          }
        );

        sendSSE("done", {});
        reply.raw.end();
      } catch (error) {
        fastify.log.error({ error }, "Search ask error");

        if (!reply.raw.headersSent) {
          return reply.status(500).send({ error: "Internal server error" });
        }

        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ error: "Internal server error" })}\n\n`
        );
        reply.raw.end();
      }
    }
  );
}
