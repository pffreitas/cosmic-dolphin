import { FastifyInstance, FastifyReply } from "fastify";
import {
  BlockResponse,
  FollowResponse,
  PublicProfile,
  PublicProfileListResponse,
  PublicSavesResponse,
  ServiceContainer,
  SocialValidationError,
  SOCIAL_PAGE_DEFAULT_LIMIT,
  SOCIAL_PAGE_MAX_LIMIT,
  SocialKeyset,
  createDatabase,
  createServiceContainer,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { RATE_LIMITS, rateLimited } from "../plugins/rate-limit";
import { firstZodMessage } from "./collections";

/**
 * The social graph, addressed by handle.
 *
 * Every route here keys on `{handle}` rather than a uuid, because the profile
 * URL is the product surface — `/u/{handle}` — and a link that only works while
 * you can look up an id is not a link anyone can share
 * (docs/functional-spec/06-social.md § Profiles).
 *
 * Two things this file deliberately does *not* do:
 *
 *  - **It does not decide who can see what.** `SocialService` returns `null`
 *    for "no such handle" and for "that profile blocked you" alike, and this
 *    file turns both into the same 404. There is no branch here that could be
 *    written differently on the next endpoint and quietly become a 403.
 *  - **It does not know what a `PublicProfile` contains.** The shape comes from
 *    `packages/shared`, whose repository selects an explicit column list with
 *    no `email` in it. Nothing is deleted from an object on the way out,
 *    because nothing sensitive was ever put in one.
 */

/**
 * A social cursor.
 *
 * Keyset, opaque, and much simpler than the library's: every social listing
 * sorts by `created_at DESC, id DESC` and nothing else, so there is no
 * ordering to encode and no ordering to validate against.
 */
interface SocialCursorPayload {
  c: string;
  i: string;
}

export function encodeSocialCursor(row: {
  createdAt: Date;
  id: string;
}): string {
  const payload: SocialCursorPayload = {
    c: new Date(row.createdAt).toISOString(),
    i: row.id,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type DecodeSocialCursorResult =
  | { ok: true; cursor: SocialKeyset }
  | { ok: false; error: string };

export function decodeSocialCursor(raw: string): DecodeSocialCursorResult {
  let payload: SocialCursorPayload;

  try {
    payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid cursor" };
  }

  if (!payload || typeof payload !== "object" || typeof payload.i !== "string") {
    return { ok: false, error: "Invalid cursor" };
  }

  const createdAt = new Date(payload.c);
  if (Number.isNaN(createdAt.getTime())) {
    return { ok: false, error: "Invalid cursor" };
  }

  return { ok: true, cursor: { createdAt, id: payload.i } };
}

export const socialPageQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SOCIAL_PAGE_MAX_LIMIT)
    .optional()
    .default(SOCIAL_PAGE_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
});

/**
 * A handle is 3–30 lowercase characters. Anything else cannot exist, so it is
 * a 404 rather than a 400: a caller probing `/users/DROP TABLE` should get the
 * same answer as one probing a handle that is merely unused.
 */
export const handleParamSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/);

export function isPossibleHandle(handle: string): boolean {
  return handleParamSchema.safeParse(handle).success;
}

/** A rule the caller broke — following themselves, mostly — is a 400. */
export function replyForSocialError(
  reply: FastifyReply,
  error: unknown
): FastifyReply | null {
  if (!(error instanceof SocialValidationError)) return null;
  return reply.status(400).send({ error: error.message });
}

export default async function userRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  const notFound = (reply: FastifyReply) =>
    reply.status(404).send({ error: "Profile not found" });

  fastify.get<{
    Params: { handle: string };
    Reply: PublicProfile | { error: string };
  }>(
    "/users/:handle",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        const profile = await services.social.getPublicProfile(
          handle,
          request.userId
        );

        // 404, never 403. See the file header.
        if (!profile) return notFound(reply);

        return reply.send(profile);
      } catch (error) {
        fastify.log.error({ error }, "Get public profile error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{
    Params: { handle: string };
    Querystring: { limit?: string; cursor?: string };
    Reply: PublicSavesResponse | { error: string };
  }>(
    "/users/:handle/saves",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        const parsed = socialPageQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        let cursor: SocialKeyset | null = null;
        if (parsed.data.cursor) {
          const decoded = decodeSocialCursor(parsed.data.cursor);
          if (!decoded.ok) {
            return reply.status(400).send({ error: decoded.error });
          }
          cursor = decoded.cursor;
        }

        const page = await services.social.listPublicSaves(handle, {
          viewerId: request.userId,
          limit: parsed.data.limit,
          cursor,
        });

        if (!page) return notFound(reply);

        return reply.send({
          bookmarks: page.bookmarks,
          ...(page.lastRow
            ? { nextCursor: encodeSocialCursor(page.lastRow) }
            : {}),
        });
      } catch (error) {
        fastify.log.error({ error }, "Get public saves error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  const graphList = (direction: "followers" | "following") =>
    async (
      request: {
        params: { handle: string };
        query: { limit?: string; cursor?: string };
        userId?: string;
      },
      reply: FastifyReply
    ) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        const parsed = socialPageQuerySchema.safeParse(request.query ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        let cursor: SocialKeyset | null = null;
        if (parsed.data.cursor) {
          const decoded = decodeSocialCursor(parsed.data.cursor);
          if (!decoded.ok) {
            return reply.status(400).send({ error: decoded.error });
          }
          cursor = decoded.cursor;
        }

        const options = {
          viewerId: request.userId,
          limit: parsed.data.limit,
          cursor,
        };

        const page =
          direction === "followers"
            ? await services.social.listFollowers(handle, options)
            : await services.social.listFollowing(handle, options);

        if (!page) return notFound(reply);

        return reply.send({
          profiles: page.profiles,
          ...(page.lastRow
            ? { nextCursor: encodeSocialCursor(page.lastRow) }
            : {}),
        });
      } catch (error) {
        fastify.log.error({ error }, `Get ${direction} error`);
        return reply.status(500).send({ error: "Internal server error" });
      }
    };

  fastify.get<{
    Params: { handle: string };
    Querystring: { limit?: string; cursor?: string };
    Reply: PublicProfileListResponse | { error: string };
  }>(
    "/users/:handle/followers",
    { preHandler: authMiddleware },
    graphList("followers")
  );

  fastify.get<{
    Params: { handle: string };
    Querystring: { limit?: string; cursor?: string };
    Reply: PublicProfileListResponse | { error: string };
  }>(
    "/users/:handle/following",
    { preHandler: authMiddleware },
    graphList("following")
  );

  fastify.put<{
    Params: { handle: string };
    Reply: FollowResponse | { error: string };
  }>(
    "/users/:handle/follow",
    {
      preHandler: authMiddleware,
      // 100/hour, from the one place limits are declared.
      config: rateLimited(RATE_LIMITS.follows),
    },
    async (request, reply) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        const result = await services.social.follow(request.userId!, handle);
        if (!result) return notFound(reply);

        return reply.send(result);
      } catch (error) {
        const handled = replyForSocialError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Follow error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { handle: string };
    Reply: FollowResponse | { error: string };
  }>(
    "/users/:handle/follow",
    {
      preHandler: authMiddleware,
      // Unfollow shares the follows bucket on purpose: the abuse pattern is
      // follow-unfollow churn, and limiting only one half of it would leave
      // the loop running at half speed rather than stopping it.
      config: rateLimited(RATE_LIMITS.follows),
    },
    async (request, reply) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        const result = await services.social.unfollow(request.userId!, handle);
        if (!result) return notFound(reply);

        return reply.send(result);
      } catch (error) {
        const handled = replyForSocialError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Unfollow error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Params: { handle: string };
    Reply: BlockResponse | { error: string };
  }>(
    "/users/:handle/block",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        // Not rate limited. Blocking is the thing a person reaches for when
        // something has gone wrong, and a limiter between them and it would be
        // protecting the wrong party.
        const result = await services.social.block(request.userId!, handle);
        if (!result) return notFound(reply);

        return reply.send(result);
      } catch (error) {
        const handled = replyForSocialError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Block error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.delete<{
    Params: { handle: string };
    Reply: BlockResponse | { error: string };
  }>(
    "/users/:handle/block",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { handle } = request.params;
        if (!isPossibleHandle(handle)) return notFound(reply);

        const result = await services.social.unblock(request.userId!, handle);
        if (!result) return notFound(reply);

        return reply.send(result);
      } catch (error) {
        const handled = replyForSocialError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Unblock error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
