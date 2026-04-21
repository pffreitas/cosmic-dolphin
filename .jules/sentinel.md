## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-21 - Server-Sent Events Bypass Standard Fastify CORS Plugin
**Vulnerability:** Fastify endpoints that use `reply.raw.writeHead` to manually send HTTP headers (such as Server-Sent Events in `apps/api/src/routes/search.ts`) bypass the standard `@fastify/cors` plugin. This required manual configuration of the `Access-Control-Allow-Origin` header, which was insecurely implemented to reflect any arbitrary origin (`request.headers.origin || "*"`).
**Learning:** Standard Fastify security plugins do not automatically intercept and validate raw Node.js HTTP responses. When implementing protocols like SSE that rely on raw responses, developers must be extremely careful to manually implement equivalent security controls, like strict CORS validation.
**Prevention:** Always validate against a strict list of allowed origins (e.g., using a configured `FRONTEND_URL` environment variable) instead of reflecting the `Origin` header from the request when implementing custom raw HTTP responses.
