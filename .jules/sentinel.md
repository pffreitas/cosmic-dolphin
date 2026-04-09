## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-05-25 - Manual SSE Headers Bypass Global CORS
**Vulnerability:** The Server-Sent Events endpoint `/search/ask` manually set the `Access-Control-Allow-Origin` header to blindly reflect `request.headers.origin`, bypassing the global `@fastify/cors` plugin and allowing arbitrary cross-origin requests.
**Learning:** When using Fastify and manually writing headers to `reply.raw` (e.g., for SSE), global plugins like `@fastify/cors` do not automatically apply to those raw responses, creating a hidden security gap.
**Prevention:** Always manually validate incoming origins against a strict whitelist (e.g., from environment variables) before echoing them back in manual header responses for SSE or streaming endpoints.
