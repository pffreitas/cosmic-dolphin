## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-15 - Overly Permissive CORS in Server-Sent Events
**Vulnerability:** The SSE endpoint in `apps/api` reflected arbitrary origins (`request.headers.origin || "*"`) instead of enforcing a strict CORS policy, bypassing the standard `@fastify/cors` plugin.
**Learning:** When using Fastify's `reply.raw.writeHead` for Server-Sent Events, standard `@fastify/cors` plugin headers are bypassed. This can lead to overly permissive CORS if manual headers reflect user input.
**Prevention:** Manually validate and strictly set `Access-Control-Allow-Origin` using a trusted configuration value (like `FRONTEND_URL`) rather than reflecting the request origin when bypassing standard plugins.
