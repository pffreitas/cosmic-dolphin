import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { createDatabase, createServiceContainer, InvalidPickTimeZone, type PicksServiceImpl } from "@cosmic-dolphin/shared";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { firstZodMessage } from "./collections";

// Route registration accepts an isolated test auth boundary, like bookmark routes.
export async function registerPicksRoutes(app: FastifyInstance, authenticate: preHandlerHookHandler, service: PicksServiceImpl) {
  app.get<{ Querystring: { tz?: string } }>("/picks/today", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ tz: z.string().min(1).max(255) }).safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: firstZodMessage(parsed.error) });
    try {
      return reply.send(await service.today(request.userId!, parsed.data.tz));
    } catch (error) {
      if (error instanceof InvalidPickTimeZone) return reply.status(400).send({ error: "Unknown time zone" });
      app.log.error({ error }, "Get picks error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}

export default async function picksRoutes(app: FastifyInstance) {
  const db = createDatabase(config.DATABASE_URL);
  const services = createServiceContainer(createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY), db, config.NODE_ENV);
  app.addHook("onClose", async () => { await db.destroy(); });
  await registerPicksRoutes(app, authMiddleware, services.picks);
}
