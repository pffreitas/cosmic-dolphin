import { FastifyRequest, FastifyReply } from "fastify";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/environment";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid authorization header" });
    }

    const token = authorization.split(" ")[1];

    const supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase.auth.getUser(token);

    if (error || !user?.user) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }

    request.userId = user.user.id;
  } catch (error) {
    return reply.status(401).send({ error: "Authentication failed" });
  }
}