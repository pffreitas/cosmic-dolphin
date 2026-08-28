import { FastifyInstance } from "fastify";
import {
  FeedCursor,
  FeedItem,
  FeedResponse,
  FeedScope,
  ServiceContainer,
  createDatabase,
  createServiceContainer,
  isFeedScope,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { firstZodMessage } from "./collections";

/**
 * The ranked Home feed — docs/functional-spec/05-feed.md.
 *
 * The route is thin on purpose. Every judgement about what a person should see
 * lives in `FeedRankingService`, which is pure below its candidate query and
 * therefore testable without a database. What lives *here* is the one thing the
 * service deliberately does not own: the opaque encoding of the cursor.
 *
 * **Cursor, never offset.** This is the whole reason the file exists rather
 * than the old `limit`/`offset` handler surviving. The candidate set is
 * re-ranked between requests, so page 2 of an offset pagination is page 2 of a
 * list that no longer exists: some items appear twice, others are never shown
 * at all. The cursor instead carries the *ranking session* it was produced
 * under, so paging inside one session is stable even though the next
 * recomputation will order things differently.
 */

/**
 * What a feed cursor actually carries.
 *
 * Short keys because it goes in a query string, and opaque because a client
 * that learns to read it will start constructing them — and a hand-made
 * position into a session it did not receive is a page of items in an order
 * nobody computed.
 */
interface FeedCursorPayload {
  /** Scope. A cursor is only valid for the scope it was produced under. */
  s: FeedScope;
  /** The ranking session's token. */
  t: string;
  /** Position within that session's ordering. */
  p: number;
}

export function encodeFeedCursor(cursor: FeedCursor): string {
  const payload: FeedCursorPayload = {
    s: cursor.scope,
    t: cursor.session,
    p: cursor.position,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type DecodeFeedCursorResult =
  | { ok: true; cursor: FeedCursor }
  | { ok: false; error: string };

/**
 * Decode, and refuse anything that is not exactly what was handed out.
 *
 * The `scope` check is the one that matters: a cursor produced under `for_you`
 * replayed against `following` would index into an ordering built from a
 * different candidate set. That is a 400, not a best effort — the alternative
 * is silently serving positions from someone's other feed.
 */
export function decodeFeedCursor(
  raw: string,
  scope: FeedScope
): DecodeFeedCursorResult {
  let payload: FeedCursorPayload;

  try {
    payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid cursor" };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid cursor" };
  }

  if (typeof payload.t !== "string" || payload.t.length === 0) {
    return { ok: false, error: "Invalid cursor" };
  }

  if (!Number.isInteger(payload.p) || payload.p < 0) {
    return { ok: false, error: "Invalid cursor" };
  }

  if (typeof payload.s !== "string" || !isFeedScope(payload.s)) {
    return { ok: false, error: "Invalid cursor" };
  }

  if (payload.s !== scope) {
    return { ok: false, error: "Cursor does not match the requested scope" };
  }

  return {
    ok: true,
    cursor: { scope: payload.s, session: payload.t, position: payload.p },
  };
}

/**
 * Page size 20, ceiling 50 — docs/functional-spec/05-feed.md § Delivery.
 *
 * The ceiling is here as well as in the ranking parameters because a request
 * for a thousand items should be told it is wrong rather than quietly served
 * fifty; the service clamps, this rejects.
 */
export const FEED_PAGE_DEFAULT_LIMIT = 20;
export const FEED_PAGE_MAX_LIMIT = 50;

export const feedQuerySchema = z.object({
  scope: z
    .enum(["for_you", "following", "unread"])
    .optional()
    .default("for_you"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FEED_PAGE_MAX_LIMIT)
    .optional()
    .default(FEED_PAGE_DEFAULT_LIMIT),
});

/**
 * `signals` is a debugging aid, not a product surface.
 *
 * It ships outside production so the ranker's arithmetic can be read off a
 * response, and is stripped in it — a per-signal breakdown is exactly the
 * material a client would need to start synthesising its own reason sentence,
 * which is the thing the spec forbids. `rankingReason` is never stripped: it
 * is the promise.
 */
export function stripDebugSignals(
  items: FeedItem[],
  includeSignals: boolean
): FeedItem[] {
  if (includeSignals) return items;

  return items.map((item) => {
    if (!item.signals) return item;
    const { signals, ...rest } = item;
    return rest;
  });
}

export default async function feedRoutes(fastify: FastifyInstance) {
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

  const includeSignals = config.NODE_ENV !== "production";

  fastify.get<{
    Querystring: { scope?: string; cursor?: string; limit?: string };
    Reply: FeedResponse | { error: string };
  }>("/bookmarks/feed", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = feedQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const { scope, limit } = parsed.data;

      let cursor: FeedCursor | null = null;
      if (parsed.data.cursor) {
        const decoded = decodeFeedCursor(parsed.data.cursor, scope);
        if (!decoded.ok) {
          return reply.status(400).send({ error: decoded.error });
        }
        cursor = decoded.cursor;
      }

      const page = await services.feed.getFeed(request.userId!, {
        scope,
        limit,
        cursor,
      });

      // The plan's open decision on the interest vector says to measure the
      // cost before materialising it on a nightly job. This line is the
      // measurement — one structured log per ranking, so the question gets
      // answered by production rather than by argument. Cache hits log too, so
      // the hit rate is readable from the same field.
      fastify.log.info(
        {
          scope,
          user_id: request.userId,
          cache_hit: page.metrics.cacheHit,
          candidate_count: page.metrics.candidateCount,
          interest_vector_ms: page.metrics.interestVectorMs,
          total_ms: page.metrics.totalMs,
        },
        "Feed ranked"
      );

      return reply.send({
        items: stripDebugSignals(page.items, includeSignals),
        nextCursor: page.nextCursor
          ? encodeFeedCursor(page.nextCursor)
          : undefined,
        computedAt: page.computedAt,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      fastify.log.error({ errorMessage, errorStack }, "Get feed error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
