## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-23 - Strict CORS Bypass via Raw Server-Sent Events Header Reflection
**Vulnerability:** Fastify's standard `@fastify/cors` plugin was bypassed in Server-Sent Events (SSE) endpoints (like `/search/ask`) using `reply.raw.writeHead`, which manually reflected arbitrary request origins via `request.headers.origin || "*"`.
**Learning:** Manual response header manipulation in Fastify (e.g., using `.raw` for streaming protocols like SSE) circumvents globally configured framework security plugins, creating hidden vulnerabilities such as overly permissive CORS policies.
**Prevention:** Always centralize origin validation logic and explicitly check manually written `Access-Control-Allow-Origin` headers against configured, trusted environment variables (e.g., `FRONTEND_URL`) when using raw response manipulation.
