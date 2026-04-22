## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-22 - Bypassed CORS Validation in Server-Sent Events (SSE)
**Vulnerability:** The Fastify SSE endpoint in `apps/api/src/routes/search.ts` manually set CORS headers using `reply.raw.writeHead`, bypassing the standard `@fastify/cors` plugin. It insecurely reflected the `origin` header from requests or used a wildcard `*`, creating a security risk.
**Learning:** When manually writing HTTP headers (e.g., using `reply.raw.writeHead` for SSE), standard framework middleware and plugins (like CORS protection) are often bypassed. Manual header setting requires manual, rigorous security validation. Overly permissive CORS policies (like wildcard or reflection) can expose sensitive data or actions to unauthorized domains.
**Prevention:** Always validate CORS origins against a strictly defined whitelist or configuration variable (e.g., `FRONTEND_URL`) when manually setting `Access-Control-Allow-Origin` headers. Avoid reflecting arbitrary origins or using `*` for sensitive endpoints, especially those using credentials.
