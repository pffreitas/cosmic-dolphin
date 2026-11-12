import type { FastifyInstance } from "fastify";
import { createDatabase, createServiceContainer, type ServiceContainer } from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";

export async function registerShareKeyRoutes(app: FastifyInstance, services: ServiceContainer, authenticate = authMiddleware) {
  app.post("/share-keys", { preHandler: authenticate }, async (request, reply) => {
    const body = z.object({ deviceId: z.string().trim().min(1).max(200) }).strict().safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Invalid deviceId" });
    const result = await services.shareKey.issue(request.userId!, body.data.deviceId);
    return reply.status(201).send(result);
  });
  app.delete<{ Params: { id: string } }>("/share-keys/:id", { preHandler: authenticate }, async (request, reply) => {
    if (!z.string().uuid().safeParse(request.params.id).success) return reply.status(400).send({ error: "Invalid key id" });
    await services.shareKey.revoke(request.params.id, request.userId!);
    return reply.status(204).send();
  });
}
export default async function shareKeyRoutes(app: FastifyInstance) {
  const services = createServiceContainer(createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY), createDatabase(config.DATABASE_URL));
  await registerShareKeyRoutes(app, services);
}
