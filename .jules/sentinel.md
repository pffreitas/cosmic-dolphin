## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-06 - Manual SSE Endpoints Bypass Global CORS Plugins
**Vulnerability:** The SSE endpoint `/search/ask` manually set the `Access-Control-Allow-Origin` header using `request.headers.origin || "*"`, reflecting arbitrary origins and bypassing the global `@fastify/cors` validation.
**Learning:** When using raw response writing (e.g., `reply.raw.writeHead`) in Fastify to implement streaming protocols like Server-Sent Events, standard middleware and plugins (like CORS) may be bypassed. This requires manual, secure validation of headers against explicitly trusted origins.
**Prevention:** Never reflect arbitrary origins in CORS headers. Always validate against a configured `FRONTEND_URL` or a strict allowlist, and review all endpoints using raw response streams for proper security header implementation.
