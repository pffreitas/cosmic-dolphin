## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-14 - Permissive CORS Configuration and Reflection
**Vulnerability:** Fastify's CORS plugin was configured with `origin: true`, and the Server-Sent Events (SSE) endpoint dynamically reflected `request.headers.origin || "*"`, enabling any external website to potentially read sensitive authenticated API responses (like search results) due to lack of origin validation.
**Learning:** SSE endpoints using `reply.raw.writeHead` bypass standard Fastify plugin headers, requiring manual application of security headers like CORS. Relying on `origin: true` or directly reflecting the request origin defeats same-origin policies.
**Prevention:** Always restrict CORS `origin` to explicit, validated URLs (e.g., loaded from environment variables like `FRONTEND_URL`), and ensure manual endpoints correctly validate `request.headers.origin` before reflecting it in `Access-Control-Allow-Origin`.
