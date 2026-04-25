## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-25 - Insecure CORS and Manual Header Bypass
**Vulnerability:** The application used `origin: true` for the `@fastify/cors` plugin and reflected `request.headers.origin` directly into the `Access-Control-Allow-Origin` header for manual Server-Sent Events (SSE) endpoints.
**Learning:** Manual endpoints (like SSE using `reply.raw.writeHead`) bypass standard Fastify CORS plugins. Reflecting the Origin header without strict validation allows arbitrary websites to access sensitive endpoints.
**Prevention:** Always use an explicitly configured and validated environment variable (like `FRONTEND_URL`) for both Fastify CORS configuration and manual endpoint headers, rather than blindly trusting the request origin.
