## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-08 - Arbitrary Origin Reflection in SSE CORS Headers
**Vulnerability:** The Server-Sent Events (SSE) endpoint in `apps/api/src/routes/search.ts` manually wrote CORS headers using `request.headers.origin || "*"`, allowing arbitrary origins to connect and potentially read sensitive stream data, bypassing the standard `@fastify/cors` plugin which it overrides.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for SSE) bypass framework-level CORS protections. When writing raw headers, developers sometimes fall back to insecure patterns like reflecting the request's origin because standard plugins aren't active for the stream.
**Prevention:** Always validate manual CORS headers against an explicitly configured trusted origin list (e.g., `FRONTEND_URL`) instead of trusting the client's `Origin` header.
