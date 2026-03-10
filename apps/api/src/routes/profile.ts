import { FastifyInstance } from "fastify";
import {
  ServiceContainer,
  createServiceContainer,
  createDatabase,
  Profile,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

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
}
