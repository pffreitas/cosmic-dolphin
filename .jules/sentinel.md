## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-06-03 - Permissive CORS and SSE Origin Reflection
**Vulnerability:** The Fastify CORS plugin was configured with `origin: true`, allowing cross-origin requests from any domain. Additionally, a Server-Sent Events (SSE) endpoint manually reflected arbitrary `request.headers.origin` values into the `Access-Control-Allow-Origin` header without validation.
**Learning:** Using `origin: true` in Fastify completely disables cross-origin protection in production. When using `reply.raw.writeHead` for SSE, standard Fastify CORS headers are bypassed, requiring manual validation against an explicit list of allowed origins.
**Prevention:** Always use an environment variable (like `CORS_ORIGIN`) to explicitly define allowed origins, split comma-separated values, and validate incoming origins strictly against this list even for raw SSE responses.
