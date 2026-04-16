## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-16 - Manual SSE Endpoint Bypasses Fastify CORS Plugin
**Vulnerability:** The SSE endpoint `/search` in `apps/api/src/routes/search.ts` manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` because it used `reply.raw.writeHead`, bypassing the `@fastify/cors` plugin. This overly permissive CORS configuration allowed any origin to connect and potentially read sensitive data via SSE.
**Learning:** When using Fastify, endpoints that drop down to the raw Node.js response object (e.g., for SSE using `reply.raw.writeHead`) completely bypass standard Fastify plugins like `@fastify/cors`. Security headers must be manually and securely implemented in these specific endpoints, rather than assuming plugin coverage.
**Prevention:** Always manually validate and set the `Access-Control-Allow-Origin` header against a trusted configuration value (like `FRONTEND_URL`) when using `reply.raw.writeHead`, and ensure the main `@fastify/cors` plugin is also restricted to trusted origins.
