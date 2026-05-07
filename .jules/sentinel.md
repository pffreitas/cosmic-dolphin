## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-07 - Server-Sent Events Bypass Standard CORS Plugins
**Vulnerability:** Fastify SSE implementations using `reply.raw.writeHead` bypassed the standard `@fastify/cors` plugin, and the origin was manually reflected using `request.headers.origin || "*"`.
**Learning:** Manual HTTP responses (like SSE streams) bypass standard security plugins, requiring CORS headers to be manually implemented and securely validated against explicit allowed origins.
**Prevention:** Always validate manual CORS headers against a configured trusted `FRONTEND_URL` rather than reflecting arbitrary origins.
