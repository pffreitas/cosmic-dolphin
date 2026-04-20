## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-20 - SSE CORS Reflection Vulnerability
**Vulnerability:** The Server-Sent Events (SSE) endpoint at `/search/ask` manually wrote CORS headers using `reply.raw.writeHead`, completely bypassing the `@fastify/cors` plugin and reflecting any `Origin` header provided by the client (`Access-Control-Allow-Origin: request.headers.origin || "*"`), combined with `Access-Control-Allow-Credentials: "true"`.
**Learning:** Using `reply.raw.writeHead` in Fastify bypasses standard plugin interceptors. When configuring headers manually for raw streams, security controls like CORS must be manually validated against allowed origins rather than blindly reflecting the client's request.
**Prevention:** Centralize CORS configuration via the framework's plugin system where possible. If manual headers are strictly required for raw responses (like SSE), securely validate the `Origin` header against a known, strict list (e.g., `config.FRONTEND_URL`) instead of reflecting arbitrary input.
