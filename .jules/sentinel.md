## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-27 - [HIGH] Fix CORS origin reflection in SSE and enforce strict frontend URL
**Vulnerability:** The API allowed arbitrary origins globally using `origin: true` in `@fastify/cors` and manually reflected `request.headers.origin || "*"` in the Server-Sent Events (SSE) endpoint.
**Learning:** When using Server-Sent Events (SSE) in Fastify with `reply.raw.writeHead`, standard `@fastify/cors` plugin headers are bypassed. CORS headers like `Access-Control-Allow-Origin` must be manually and securely validated against allowed origins rather than reflecting arbitrary origins.
**Prevention:** Ensure strict CORS origin validation using a centralized configured URL (e.g., `FRONTEND_URL`) for both standard plugins and manual header writing to prevent malicious origins from accessing sensitive data.
