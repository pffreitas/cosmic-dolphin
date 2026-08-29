import { FastifyInstance } from "fastify";
import {
  FeedCursor,
  FeedFeedbackInput,
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

/**
 * Feedback — docs/functional-spec/05-feed.md § Feedback.
 *
 * The discriminated union is the whole schema, and it is worth the extra
 * lines: each kind requires exactly the target it is about and refuses the
 * other two. A `fewer_domain` carrying only a `bookmarkId` is a 400, because
 * the alternative — inferring the domain from the bookmark — silences a source
 * the reader never named, and a feed that mutes the wrong thing is worse than
 * one that does nothing.
 *
 * `domain` and `topic` are lower-cased and trimmed here, at the edge, so the
 * uniqueness the table promises is uniqueness of *opinions* rather than of
 * spellings.
 */
const normalisedText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => value.toLowerCase());

export const feedFeedbackSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("not_interested"),
    bookmarkId: z.string().uuid("bookmarkId must be a bookmark id"),
  }),
  z.object({
    kind: z.literal("fewer_domain"),
    // A host, not a URL. The client already renders the bare domain in the
    // provenance row, so asking it for anything else would be asking it to
    // un-parse something it has already parsed.
    domain: normalisedText(253),
  }),
  z.object({
    kind: z.literal("mute_topic"),
    topic: normalisedText(120),
  }),
]);

export const feedRailQuerySchema = z.object({
  topicLimit: z.coerce.number().int().min(1).max(20).optional().default(6),
  peopleLimit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

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

  /**
   * "Not interested", "Fewer from this domain", "Mute topic".
   *
   * The one behaviour worth naming here rather than only in the service: the
   * write drops the caller's cached ranking, which is what makes the promise
   * in the spec — "takes effect on the next request, visibly" — a fact about
   * the product rather than about the next cache expiry.
   */
  fastify.post<{
    Body: unknown;
    Reply:
      | {
          kind: FeedFeedbackInput["kind"];
          bookmarkId?: string;
          domain?: string;
          topic?: string;
          rankingInvalidated: boolean;
        }
      | { error: string };
  }>("/feed/feedback", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = feedFeedbackSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const input = parsed.data;

      await services.feed.recordFeedback(request.userId!, {
        kind: input.kind,
        bookmarkId: input.kind === "not_interested" ? input.bookmarkId : null,
        domain: input.kind === "fewer_domain" ? input.domain : null,
        topic: input.kind === "mute_topic" ? input.topic : null,
      });

      return reply.send({
        kind: input.kind,
        bookmarkId: input.kind === "not_interested" ? input.bookmarkId : undefined,
        domain: input.kind === "fewer_domain" ? input.domain : undefined,
        topic: input.kind === "mute_topic" ? input.topic : undefined,
        // `recordFeedback` invalidates as part of the write, so by the time a
        // response exists the ranking is already gone.
        rankingInvalidated: true,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      fastify.log.error({ errorMessage }, "Feed feedback error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * Home's rail, minus Continue reading — which has had its own route since
   * D8 and does not need a second definition of "part-way through".
   */
  fastify.get<{
    Querystring: { topicLimit?: string; peopleLimit?: string };
  }>("/feed/rail", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = feedRailQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const rail = await services.feed.getRail(request.userId!, parsed.data);

      return reply.send({
        topics: rail.topics.map((row) => ({
          topic: row.topic,
          count: row.count,
        })),
        people: rail.people.map((row) => ({
          person: {
            id: row.profile.id,
            handle: row.profile.handle ?? "",
            name: row.profile.name ?? undefined,
            pictureUrl: row.profile.picture_url ?? undefined,
          },
          savesThisWeek: row.savesInWindow,
        })),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      fastify.log.error({ errorMessage }, "Get feed rail error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
