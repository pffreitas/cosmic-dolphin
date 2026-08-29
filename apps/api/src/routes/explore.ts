import { FastifyInstance } from "fastify";
import {
  ExploreKeyset,
  ExploreRailResponse,
  ExploreResponse,
  EXPLORE_PAGE_MAX_LIMIT,
  EXPLORE_PAGE_DEFAULT_LIMIT,
  ServiceContainer,
  createDatabase,
  createServiceContainer,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { firstZodMessage } from "./collections";

/**
 * Explore — docs/design-system/pages.md § Explore.
 *
 * Thin, like `feed.ts`, and for the same reason: everything about what a
 * person should see lives in `ExploreService`. What lives here is the cursor's
 * opaque encoding, which the service deliberately does not own.
 *
 * Explore's cursor is a **score keyset**, not a session token. That is the one
 * place it differs from the feed's, and the difference is real: the feed
 * re-ranks between requests against a personalised interest vector, so paging
 * has to be pinned to the session it started in. Explore's score is arithmetic
 * over columns anybody can read — engagement over age — so the same row scores
 * the same on the next request whoever is asking, and `(score, created_at, id)`
 * is a stable position without a session to pin it to.
 */

interface ExploreCursorPayload {
  /** Score. */
  s: number;
  /** `created_at`, ISO. */
  c: string;
  /** Bookmark id. */
  i: string;
}

export function encodeExploreCursor(cursor: ExploreKeyset): string {
  const payload: ExploreCursorPayload = {
    s: cursor.score,
    c: new Date(cursor.createdAt).toISOString(),
    i: cursor.id,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type DecodeExploreCursorResult =
  | { ok: true; cursor: ExploreKeyset }
  | { ok: false; error: string };

export function decodeExploreCursor(raw: string): DecodeExploreCursorResult {
  let payload: ExploreCursorPayload;

  try {
    payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid cursor" };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid cursor" };
  }

  if (typeof payload.s !== "number" || !Number.isFinite(payload.s)) {
    return { ok: false, error: "Invalid cursor" };
  }

  if (typeof payload.i !== "string" || payload.i.length === 0) {
    return { ok: false, error: "Invalid cursor" };
  }

  const createdAt = new Date(payload.c);
  if (Number.isNaN(createdAt.getTime())) {
    return { ok: false, error: "Invalid cursor" };
  }

  return { ok: true, cursor: { score: payload.s, createdAt, id: payload.i } };
}

export const exploreQuerySchema = z.object({
  // Trimmed and lower-cased at the edge, the same way feed feedback normalises
  // its topic — so `/explore?topic=AI` and `/explore?topic=ai` are one filter
  // rather than two that disagree.
  topic: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((value) => value.toLowerCase())
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(EXPLORE_PAGE_MAX_LIMIT)
    .optional()
    .default(EXPLORE_PAGE_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
});

export const exploreRailQuerySchema = z.object({
  collectionLimit: z.coerce.number().int().min(1).max(20).optional().default(4),
  peopleLimit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export default async function exploreRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(
    supabase,
    db,
    config.NODE_ENV
  );

  fastify.get<{
    Querystring: { topic?: string; limit?: string; cursor?: string };
    Reply: ExploreResponse | { error: string };
  }>("/explore", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = exploreQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      let cursor: ExploreKeyset | null = null;
      if (parsed.data.cursor) {
        const decoded = decodeExploreCursor(parsed.data.cursor);
        if (!decoded.ok) {
          return reply.status(400).send({ error: decoded.error });
        }
        cursor = decoded.cursor;
      }

      const page = await services.explore.list(request.userId!, {
        topic: parsed.data.topic ?? null,
        limit: parsed.data.limit,
        cursor,
      });

      return reply.send({
        items: page.items,
        topics: page.topics,
        ...(page.lastRow
          ? { nextCursor: encodeExploreCursor(page.lastRow) }
          : {}),
        computedAt: page.computedAt,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      fastify.log.error({ errorMessage }, "Explore list error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.get<{
    Querystring: { collectionLimit?: string; peopleLimit?: string };
    Reply: ExploreRailResponse | { error: string };
  }>("/explore/rail", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = exploreRailQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const rail = await services.explore.rail(request.userId!, parsed.data);

      return reply.send(rail);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      fastify.log.error({ errorMessage }, "Explore rail error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
