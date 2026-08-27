import { FastifyInstance, FastifyReply } from "fastify";
import {
  Collection,
  CollectionError,
  CollectionSuggestion,
  ServiceContainer,
  createDatabase,
  createServiceContainer,
  MAX_COLLECTION_NAME_LENGTH,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

/**
 * The collection tree, split out of `bookmarks.ts`.
 *
 * Everything under `/collections` lives here, by the repo's resource-domain
 * convention. The one collection operation that does **not** live here is
 * `PATCH /bookmarks/{id}/collection`: it is addressed as a bookmark, so it
 * stays in `bookmarks.ts` — the convention keys on the path, not on the table
 * the write lands in.
 *
 * The two-level cap is not enforced in this file. It lives in
 * `CollectionService`, so create, reparent and accept-a-suggestion all run the
 * same check and a fourth caller cannot arrive later and miss it. This file's
 * job is to turn a `CollectionError` into the right status code.
 */

const collectionIdSchema = z.string().uuid("Invalid collection id");

const nameSchema = z
  .string()
  .trim()
  .min(1, "name is required")
  .max(
    MAX_COLLECTION_NAME_LENGTH,
    `name must be at most ${MAX_COLLECTION_NAME_LENGTH} characters`
  );

export const createCollectionSchema = z.object({
  name: nameSchema,
  description: z.string().nullish(),
  color: z.string().nullish(),
  icon: z.string().nullish(),
  parentId: collectionIdSchema.nullish(),
  isPublic: z.boolean().optional(),
});

/**
 * Rename, recolour, reparent — one schema, every field optional.
 *
 * `null` and absent are deliberately different: absent leaves the field alone,
 * `null` clears it, and `parentId: null` is how a nested collection is moved
 * back to the root. `nullish()` keeps both readable; the service tells them
 * apart with `!== undefined`.
 */
export const updateCollectionSchema = z
  .object({
    name: nameSchema.optional(),
    description: z.string().nullish(),
    color: z.string().nullish(),
    icon: z.string().nullish(),
    parentId: collectionIdSchema.nullish(),
    isPublic: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "No fields to update",
  });

export const refileBookmarkSchema = z.object({
  // Required, and nullable. Absent is not "move to Inbox" — an empty PATCH body
  // must never silently unfile a bookmark.
  collectionId: collectionIdSchema.nullable(),
});

/**
 * The status code a broken collection rule deserves.
 *
 * Kept as data rather than a chain of `instanceof` checks in each handler so
 * every collection route answers the same way, and so it can be tested without
 * a server.
 */
const COLLECTION_ERROR_STATUS = {
  invalid: 400,
  not_found: 404,
  parent_not_found: 404,
  max_depth: 422,
  conflict: 409,
} as const;

export function collectionErrorStatus(error: unknown): number | null {
  if (!(error instanceof CollectionError)) return null;
  return COLLECTION_ERROR_STATUS[error.code] ?? 400;
}

/**
 * Answer a `CollectionError` with its status, or hand the error back so the
 * caller can log it and return a 500. A rule the user broke is not an incident.
 */
export function replyForCollectionError(
  reply: FastifyReply,
  error: unknown
): FastifyReply | null {
  const status = collectionErrorStatus(error);
  if (status === null) return null;
  return reply.status(status).send({ error: (error as CollectionError).message });
}

export function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request body";
}

export default async function collectionRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  fastify.get<{
    Reply: { collections: Collection[] } | { error: string };
  }>("/collections", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const user_id = request.userId!;
      const collections = await services.collection.findByUser(user_id);
      return reply.send({ collections });
    } catch (error) {
      fastify.log.error({ error }, "Get collections error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  // Static before dynamic: registered first so `/collections/suggestions` is
  // never read as `/collections/:id` with an id of "suggestions".
  fastify.get<{
    Reply: { suggestions: CollectionSuggestion[] } | { error: string };
  }>(
    "/collections/suggestions",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const user_id = request.userId!;
        // Offerable, not all: a proposal below the support threshold exists but
        // is not the user's problem yet, and a dismissed one is not re-offered
        // until its 30 days are up.
        const suggestions =
          await services.collection.findOfferableSuggestions(user_id);
        return reply.send({ suggestions });
      } catch (error) {
        fastify.log.error({ error }, "Get collection suggestions error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
  }>(
    "/collections/suggestions/:id/accept",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const accepted = await services.collection.acceptSuggestion(id, user_id);

        return reply.send(accepted);
      } catch (error) {
        const handled = replyForCollectionError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Accept collection suggestion error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Reply: { suggestion: CollectionSuggestion } | { error: string };
  }>(
    "/collections/suggestions/:id/dismiss",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        // Remembered for 30 days via `dismissed_until`, not for ever. The
        // pipeline stops re-proposing this name until then.
        const suggestion = await services.collection.dismissSuggestion(
          id,
          user_id
        );

        return reply.send({ suggestion });
      } catch (error) {
        const handled = replyForCollectionError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Dismiss collection suggestion error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.post<{
    Body: unknown;
    Reply: Collection | { error: string };
  }>("/collections", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const user_id = request.userId!;

      const parsed = createCollectionSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const collection = await services.collection.createForUser(
        user_id,
        parsed.data
      );

      return reply.status(201).send(collection);
    } catch (error) {
      const handled = replyForCollectionError(reply, error);
      if (handled) return handled;
      fastify.log.error({ error }, "Create collection error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.patch<{
    Params: { id: string };
    Body: unknown;
    Reply: Collection | { error: string };
  }>(
    "/collections/:id",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        const parsed = updateCollectionSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const collection = await services.collection.updateForUser(
          id,
          user_id,
          parsed.data
        );

        return reply.send(collection);
      } catch (error) {
        const handled = replyForCollectionError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Update collection error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: { message: string } | { error: string };
  }>(
    "/collections/:id",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user_id = request.userId!;

        // The bookmarks are not touched here on purpose. `collection_id` is
        // `ON DELETE SET NULL` and Inbox *is* `collection_id IS NULL`, so they
        // land in Inbox as part of the same statement that removes the row —
        // there is no window in which a bookmark points at a collection that
        // no longer exists, and no code path in which one gets deleted.
        await services.collection.deleteForUser(id, user_id);

        return reply.send({ message: "Collection deleted successfully" });
      } catch (error) {
        const handled = replyForCollectionError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Delete collection error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
