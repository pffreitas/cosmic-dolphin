import type { FastifyRequest, FastifyReply } from "fastify";
import type { ServiceContainer } from "@cosmic-dolphin/shared";
import { authMiddleware } from "./auth";

declare module "fastify" { interface FastifyRequest { shareKeyId?: string; } }

function bearerToken(request: FastifyRequest) {
  return /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "")?.[1] ?? "";
}

/** Install on bookmark POST only; every other route retains JWT authentication. */
export function bookmarkCreateAuthentication(services: ServiceContainer, jwt = authMiddleware) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(request);
    if (!token.startsWith("cdsk_")) return jwt(request, reply);
    const row = await services.shareKey.authenticate(token);
    if (!row) return reply.status(401).send({ error: "Invalid or revoked share key" });
    request.userId = row.user_id;
    request.shareKeyId = row.id;
  };
}

/** Also covers public and unmatched routes; a restricted bearer never becomes anonymous. */
export async function restrictShareKeyRoutes(request: FastifyRequest, reply: FastifyReply) {
  if (bearerToken(request).startsWith("cdsk_") &&
      !(request.method === "POST" && request.url.split("?")[0] === "/api/v1/bookmarks")) {
    return reply.status(401).send({ error: "Share key is restricted to bookmark saves" });
  }
}
