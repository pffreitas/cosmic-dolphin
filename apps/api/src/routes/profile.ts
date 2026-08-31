import { FastifyInstance } from "fastify";
import {
  ServiceContainer,
  createServiceContainer,
  createDatabase,
  HandleCooldownError,
  HandleUnavailableError,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  Profile,
  ProfileNotFoundError,
  ProfileValidationError,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { firstZodMessage } from "./collections";

/**
 * The caller's own profile.
 *
 * `GET` is unchanged in shape apart from three new fields — `handle`,
 * `handleClaimed`, `handleChangeAvailableAt` — which is what keeps
 * `/my/profile` working through the handle rollout: an existing account has a
 * handle from the moment the migration runs, and the only new thing the client
 * has to notice is that `handleClaimed` may be false.
 *
 * `PATCH` is new and is the claim endpoint. `PUT` stays for the existing web
 * client, which sends `{ name }` and nothing else.
 */

/**
 * Everything here is optional; an absent field is left alone.
 *
 * `null` on name or picture clears the value, which is why they are `nullable`
 * rather than merely optional — the two mean different things and a client
 * that wants to remove its display name has no other way to say so. The handle
 * is not nullable: a profile without a handle has no public URL, and clearing
 * it is not an operation the product offers.
 */
export const updateProfileSchema = z.object({
  name: z.string().trim().max(200).nullish(),
  pictureUrl: z.string().trim().max(2048).nullish(),
  handle: z
    .string()
    .trim()
    .min(
      HANDLE_MIN_LENGTH,
      `A handle is between ${HANDLE_MIN_LENGTH} and ${HANDLE_MAX_LENGTH} characters.`
    )
    .max(
      HANDLE_MAX_LENGTH,
      `A handle is between ${HANDLE_MIN_LENGTH} and ${HANDLE_MAX_LENGTH} characters.`
    )
    .optional(),
});

export default async function profileRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  fastify.get<{
    Reply: Profile | { error: string };
  }>(
    "/profile",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const userId = request.userId!;
        const profile = await services.profile.findById(userId);

        if (!profile) {
          return reply.status(404).send({ error: "Profile not found" });
        }

        return reply.send(profile);
      } catch (error) {
        fastify.log.error({ error }, "Get profile error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.put<{
    Body: { name?: string; email?: string; pictureUrl?: string };
    Reply: Profile | { error: string };
  }>(
    "/profile",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const userId = request.userId!;
        const { name, email, pictureUrl } = request.body;

        const profile = await services.profile.update(userId, {
          name,
          email,
          pictureUrl,
        });

        return reply.send(profile);
      } catch (error) {
        fastify.log.error({ error }, "Update profile error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.patch<{
    Body: unknown;
    Reply: Profile | { error: string };
  }>(
    "/profile",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const userId = request.userId!;

        const parsed = updateProfileSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const profile = await services.profile.updateProfile(userId, {
          // Passed through, `null` and all: `null` clears the field and
          // `undefined` leaves it alone, and collapsing the two here would
          // take away the only way to remove a display name.
          name: parsed.data.name,
          pictureUrl: parsed.data.pictureUrl,
          handle: parsed.data.handle,
        });

        return reply.send(profile);
      } catch (error) {
        // Two different 409s, both of which the user can act on: pick another
        // handle, or come back later. Neither is an incident, and neither is a
        // 400 — the request was well formed, the world said no.
        if (
          error instanceof HandleUnavailableError ||
          error instanceof HandleCooldownError
        ) {
          return reply.status(409).send({ error: error.message });
        }

        if (error instanceof ProfileNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }

        if (error instanceof ProfileValidationError) {
          return reply.status(400).send({ error: error.message });
        }

        fastify.log.error({ error }, "Patch profile error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
