import { FastifyInstance } from "fastify";
import {
  Digest,
  ServiceContainer,
  createDatabase,
  createServiceContainer,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

/**
 * Digests — docs/functional-spec/05-feed.md § Digests.
 *
 * A digest is a first-class social object, so it gets the routes a bookmark
 * gets rather than being a field on the feed response: its own detail route,
 * its own likes, its own share link.
 *
 * Two rules live below this file rather than in it, and both are load-bearing:
 *
 *  - **Owner unless public.** Enforced in `DigestService`, which returns
 *    `null` for "does not exist" and "not yours and not shared" alike; this
 *    file turns both into 404. A 403 would confirm the digest exists, and a
 *    digest is written from someone's private library — its existence is
 *    itself information about what they read.
 *  - **Sharing a digest never touches its sources.** Enforced in the service
 *    and the repository, which write only to `feed_digests`. Resharing a
 *    digest saves the digest; the bookmarks in its `Built from` row stay
 *    exactly as private as they were.
 */

const uuidSchema = z.string().uuid("Invalid digest id");

export default async function digestRoutes(fastify: FastifyInstance) {
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
    Params: { id: string };
    Reply: Digest | { error: string };
  }>("/digests/:id", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = uuidSchema.safeParse(request.params.id);
      if (!parsed.success) {
        return reply.status(404).send({ error: "Digest not found" });
      }

      const userId = request.userId!;
      const digest = await services.digest.findForViewer(parsed.data, userId);
      if (!digest) {
        return reply.status(404).send({ error: "Digest not found" });
      }

      // Opening the detail route is the only event in the product that means
      // "they went in" for a digest — the same meaning marking a bookmark read
      // carries. Without it a digest the user opens every time would still be
      // dropped from For you after five serves, which would make seen decay a
      // timer rather than a signal. Fire-and-forget: an impression that failed
      // to record must never turn a successful read into a 500.
      void services.feed.recordDigestOpen(userId, digest.id);

      return reply.send(digest);
    } catch (error) {
      fastify.log.error({ error }, "Get digest error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.put<{
    Params: { id: string };
    Reply: { likeCount: number; isLikedByCurrentUser: boolean } | { error: string };
  }>(
    "/digests/:id/like",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const parsed = uuidSchema.safeParse(request.params.id);
        if (!parsed.success) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        const result = await services.digest.like(
          request.userId!,
          parsed.data
        );
        if (!result) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, "Like digest error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: { likeCount: number; isLikedByCurrentUser: boolean } | { error: string };
  }>(
    "/digests/:id/like",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const parsed = uuidSchema.safeParse(request.params.id);
        if (!parsed.success) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        const result = await services.digest.unlike(
          request.userId!,
          parsed.data
        );
        if (!result) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, "Unlike digest error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Reply: { isPublic: boolean; shareUrl: string } | { error: string };
  }>(
    "/digests/:id/share",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const parsed = uuidSchema.safeParse(request.params.id);
        if (!parsed.success) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        const result = await services.digest.share(
          parsed.data,
          request.userId!
        );
        // Scoped to the owner in SQL. Somebody else's digest and a digest that
        // does not exist answer identically, on purpose.
        if (!result) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, "Share digest error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { id: string };
    Reply: { isPublic: boolean; shareUrl: string } | { error: string };
  }>(
    "/digests/:id/share",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const parsed = uuidSchema.safeParse(request.params.id);
        if (!parsed.success) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        const result = await services.digest.unshare(
          parsed.data,
          request.userId!
        );
        if (!result) {
          return reply.status(404).send({ error: "Digest not found" });
        }

        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, "Unshare digest error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
