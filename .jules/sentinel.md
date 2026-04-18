## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-18 - SSE Routes Bypass Standard Fastify CORS Plugin
**Vulnerability:** A permissive CORS configuration (`request.headers.origin || "*"`) was used in an SSE route in `apps/api/src/routes/search.ts` because it used `reply.raw.writeHead`, which bypasses the `@fastify/cors` plugin.
**Learning:** When using Fastify's raw reply object (e.g., for Server-Sent Events via `reply.raw.writeHead`), the standard `@fastify/cors` plugin is bypassed, meaning CORS headers are not automatically applied. Manual CORS headers configured in raw responses must strictly validate against allowed origins rather than reflecting arbitrary `Origin` headers.
**Prevention:** Always manually configure strict, explicitly allowed origins for CORS headers when using raw responses (like SSE) in Fastify, and ensure the global CORS configuration is set to a specific origin rather than `true`.
