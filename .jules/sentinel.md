## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-05-24 - SSE CORS Bypass via Wildcard Reflection
**Vulnerability:** The SSE endpoint `/search/ask` manually wrote CORS headers using `request.headers.origin || "*"`, which allowed any origin to read the response while simultaneously setting `Access-Control-Allow-Credentials: true`.
**Learning:** Fastify's native `@fastify/cors` plugin does not automatically apply its configuration to responses generated with `reply.raw.writeHead` (like SSE streams). Developers must manually and securely implement CORS headers in these cases, and reflecting any origin with credentials is a critical security risk.
**Prevention:** Always validate `request.headers.origin` against a configured, trusted `FRONTEND_URL` or default to the trusted URL when manually setting CORS headers on custom streams.
