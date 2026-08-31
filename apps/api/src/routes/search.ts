import { FastifyInstance } from "fastify";
import {
  ServiceContainer,
  createServiceContainer,
  createDatabase,
  HybridSearchResult,
  SearchAnswerSource,
  SearchDateRange,
  SearchReadStatus,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { config, resolveFrontendOrigin } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

const READ_STATUSES: SearchReadStatus[] = ["all", "unread", "read"];
const DATE_RANGES: SearchDateRange[] = ["any", "week", "month", "year"];

function parseReadStatus(value: string | undefined): SearchReadStatus {
  return READ_STATUSES.includes(value as SearchReadStatus)
    ? (value as SearchReadStatus)
    : "all";
}

function parseDateRange(value: string | undefined): SearchDateRange {
  return DATE_RANGES.includes(value as SearchDateRange)
    ? (value as SearchDateRange)
    : "any";
}

/** The wire shape of a result row. `match` is what earns a `Related` tag. */
export function toSearchResultItem(result: HybridSearchResult) {
  return {
    bookmark: result.bookmark,
    score: result.score,
    matchedChunks: result.matchedChunks,
    match: result.match,
  };
}

export default async function searchRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  fastify.get<{
    Querystring: {
      q: string;
      limit?: number;
      collectionId?: string;
      tag?: string;
      readStatus?: string;
      dateRange?: string;
    };
  }>("/search", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { q, limit = 20, collectionId, tag } = request.query;
      const userId = request.userId!;

      if (!q || q.trim() === "") {
        return reply.status(400).send({ error: "Search query is required" });
      }

      const results = await services.search.hybridSearch(userId, q, {
        limit,
        collectionId: collectionId || undefined,
        tag: tag || undefined,
        readStatus: parseReadStatus(request.query.readStatus),
        dateRange: parseDateRange(request.query.dateRange),
      });

      return reply.send({ results: results.map(toSearchResultItem) });
    } catch (error) {
      fastify.log.error({ error }, "Hybrid search error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.post<{
    Body: { query: string };
  }>("/search/ask", { preHandler: authMiddleware }, async (request, reply) => {
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
        "Access-Control-Allow-Origin": resolveFrontendOrigin(
          request.headers.origin,
          config.FRONTEND_ORIGINS
        ),
        "Access-Control-Allow-Credentials": "true",
      });

      const sendSSE = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // The last gate on rule 8, and the only one on the wire. The service
      // already refuses to generate an answer it cannot attribute; this makes
      // the refusal structural — a chunk cannot leave the server before a
      // non-empty `sources` frame has, whatever a future service does.
      let named: SearchAnswerSource[] = [];

      await services.search.askWithContext(userId, query, {
        onSources: (sources) => {
          named = sources;
          sendSSE("sources", { sources });
        },
        onChunk: (chunk: string) => {
          if (named.length === 0) return;
          sendSSE("chunk", { text: chunk });
        },
        onResults: (results) => {
          sendSSE("results", { results: results.map(toSearchResultItem) });
        },
      });

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
  });
}
