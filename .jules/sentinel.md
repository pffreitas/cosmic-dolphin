## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-10-24 - Secure Manual SSE Endpoint CORS Headers
**Vulnerability:** The SSE endpoint in `apps/api/src/routes/search.ts` manually set `Access-Control-Allow-Origin: request.headers.origin || "*"` and `Access-Control-Allow-Credentials: true`, leading to a severe overly permissive CORS vulnerability.
**Learning:** Manual HTTP responses in Fastify bypass standard plugin headers (`@fastify/cors`), requiring developers to validate origins explicitly.
**Prevention:** Always validate manual CORS headers against a secure environment variable (e.g., `FRONTEND_URL`) rather than reflecting the client's arbitrary origin.
