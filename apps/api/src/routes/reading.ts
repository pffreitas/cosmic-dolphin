import { FastifyInstance, FastifyReply } from "fastify";
import {
  ContinueReadingItem,
  Highlight,
  ReadingValidationError,
  SaveReadingProgressResult,
  ServiceContainer,
  createDatabase,
  createServiceContainer,
  CONTINUE_READING_DEFAULT_LIMIT,
  CONTINUE_READING_MAX_LIMIT,
  MAX_HIGHLIGHT_NOTE_LENGTH,
  MAX_HIGHLIGHT_QUOTE_LENGTH,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { RATE_LIMITS, rateLimited } from "../plugins/rate-limit";
import { firstZodMessage } from "./collections";

/**
 * Reading progress and highlights.
 *
 * Split out of `bookmarks.ts` by the repo's resource-domain convention, even
 * though four of the six routes are addressed as bookmarks: what they read and
 * write is the *reader's* relationship to a bookmark, not the bookmark, and the
 * two have different shapes, different lifetimes and — in the highlights' case
 * — a different visibility rule.
 *
 * Neither of this deliverable's two real guarantees is implemented in this
 * file, and that is the point:
 *
 *  - **Monotonic progress** is a `WHERE` clause on the upsert in
 *    `BookmarkReadingRepository.saveProgress`. A comparison here would be a
 *    read-modify-write with a race in the middle; there it is one statement.
 *
 *  - **Highlights are private even on a public bookmark** because every
 *    statement against `bookmark_highlights` is scoped to `user_id` in SQL,
 *    and the table carries owner-only RLS besides. There is no route guard
 *    here to forget: a handler that omitted the caller's id would not compile,
 *    let alone leak.
 *
 * What this file owns is the wire: parse, map an error to a status, and answer.
 */

const uuidSchema = z.string().uuid("Invalid id");

/**
 * Clamped, not refused.
 *
 * `percent` is derived on the client from scroll position over content height,
 * measured against a layout that may still be settling — a 100.4 is a rounding
 * artefact, not a claim. The service clamps to 0–100. What is refused here is
 * input that is not a number at all, because that is a broken client rather
 * than an imprecise one.
 */
export const saveProgressSchema = z.object({
  percent: z.number().finite(),
  // `null` and absent both mean "no offset to remember". The reader sends
  // `null` when it cannot measure one, which is not the same as an offset of 0.
  scrollOffset: z.number().finite().nullish(),
});

export const createHighlightSchema = z.object({
  quote: z.string().min(1, "quote is required").max(
    MAX_HIGHLIGHT_QUOTE_LENGTH,
    `quote must be at most ${MAX_HIGHLIGHT_QUOTE_LENGTH} characters`
  ),
  prefix: z.string().max(400).nullish(),
  suffix: z.string().max(400).nullish(),
  note: z.string().max(
    MAX_HIGHLIGHT_NOTE_LENGTH,
    `note must be at most ${MAX_HIGHLIGHT_NOTE_LENGTH} characters`
  ).nullish(),
});

/**
 * The note is the only editable field, and it is required in the body.
 *
 * `null` clears it; absent would be ambiguous between "clear it" and "leave it"
 * on a request whose only purpose is to set it.
 */
export const updateHighlightSchema = z.object({
  note: z
    .string()
    .max(
      MAX_HIGHLIGHT_NOTE_LENGTH,
      `note must be at most ${MAX_HIGHLIGHT_NOTE_LENGTH} characters`
    )
    .nullable(),
});

export const continueReadingQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONTINUE_READING_MAX_LIMIT)
    .optional()
    .default(CONTINUE_READING_DEFAULT_LIMIT),
});

/** A rule the caller broke is a 400, not an incident. */
export function replyForReadingError(
  reply: FastifyReply,
  error: unknown
): FastifyReply | null {
  if (!(error instanceof ReadingValidationError)) return null;
  return reply.status(400).send({ error: error.message });
}

export default async function readingRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  // Static before dynamic. Fastify's router already prefers a static segment
  // over a parametric one, so this would resolve correctly registered either
  // way — but `/bookmarks/:id` lives in another file, and a reader has to be
  // able to see that "continue-reading" is not a bookmark id without going
  // and finding it.
  fastify.get<{
    Querystring: { limit?: string };
    Reply: { items: ContinueReadingItem[] } | { error: string };
  }>(
    "/bookmarks/continue-reading",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const user_id = request.userId!;

        const parsed = continueReadingQuerySchema.safeParse(
          request.query ?? {}
        );
        const limit = parsed.success
          ? parsed.data.limit
          : CONTINUE_READING_DEFAULT_LIMIT;

        const items = await services.reading.getContinueReading(user_id, limit);

        return reply.send({ items });
      } catch (error) {
        fastify.log.error({ error }, "Continue reading error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Body: unknown;
    Reply: SaveReadingProgressResult | { error: string };
  }>(
    "/bookmarks/:id/progress",
    {
      preHandler: authMiddleware,
      config: rateLimited(RATE_LIMITS.progress),
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const parsed = saveProgressSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const result = await services.reading.saveProgress(
          id,
          user_id,
          parsed.data.percent,
          parsed.data.scrollOffset ?? null
        );

        if (!result) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        // 200 whether or not the value was kept. A percent below the stored
        // one is not a failed request — it is a reader who scrolled back up,
        // and answering a 409 would make every client write error-handling for
        // something that is working exactly as intended. `accepted: false` and
        // the stored value say what happened.
        return reply.send(result);
      } catch (error) {
        const handled = replyForReadingError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Save reading progress error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{
    Params: { id: string };
    Reply: { highlights: Highlight[] } | { error: string };
  }>(
    "/bookmarks/:id/highlights",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        // No ownership check, and none needed: the query is scoped to the
        // caller, so a second viewer of a public bookmark gets their own
        // highlights on it — which is nothing, unless they made some. There is
        // no code path here that could return another reader's.
        const highlights = await services.reading.listHighlights(id, user_id);

        return reply.send({ highlights });
      } catch (error) {
        fastify.log.error({ error }, "List highlights error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: unknown;
    Reply: Highlight | { error: string };
  }>(
    "/bookmarks/:id/highlights",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const parsed = createHighlightSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const highlight = await services.reading.createHighlight(id, user_id, {
          quote: parsed.data.quote,
          prefix: parsed.data.prefix ?? undefined,
          suffix: parsed.data.suffix ?? undefined,
          note: parsed.data.note ?? undefined,
        });

        if (!highlight) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        return reply.status(201).send(highlight);
      } catch (error) {
        const handled = replyForReadingError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Create highlight error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: unknown;
    Reply: Highlight | { error: string };
  }>(
    "/highlights/:id",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        if (!uuidSchema.safeParse(id).success) {
          return reply.status(404).send({ error: "Highlight not found" });
        }

        const parsed = updateHighlightSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const highlight = await services.reading.updateHighlightNote(
          id,
          user_id,
          parsed.data.note
        );

        // 404, not 403. Another reader's highlight on a bookmark this caller
        // can see is still none of their business, and a 403 would confirm it
        // exists.
        if (!highlight) {
          return reply.status(404).send({ error: "Highlight not found" });
        }

        return reply.send(highlight);
      } catch (error) {
        const handled = replyForReadingError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Update highlight error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: { message: string } | { error: string };
  }>(
    "/highlights/:id",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        if (!uuidSchema.safeParse(id).success) {
          return reply.status(404).send({ error: "Highlight not found" });
        }

        const deleted = await services.reading.deleteHighlight(id, user_id);

        if (!deleted) {
          return reply.status(404).send({ error: "Highlight not found" });
        }

        return reply.send({ message: "Highlight deleted successfully" });
      } catch (error) {
        fastify.log.error({ error }, "Delete highlight error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
