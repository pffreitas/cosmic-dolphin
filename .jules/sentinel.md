## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-05-24 - Fastify SSE Bypasses CORS Plugin
**Vulnerability:** The Server-Sent Events (SSE) route in `apps/api/src/routes/search.ts` manually set `Access-Control-Allow-Origin: request.headers.origin || "*"` using `reply.raw.writeHead`, reflecting arbitrary origins.
**Learning:** Writing raw HTTP headers with `reply.raw.writeHead` in Fastify bypasses standard plugins like `@fastify/cors`.
**Prevention:** When writing raw HTTP headers for SSE or other custom streams, manually and securely validate the request origin against an allowed origins list rather than blindly reflecting the incoming origin header.
