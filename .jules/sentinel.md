## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-19 - Permissive CORS on SSE Endpoints
**Vulnerability:** The SSE endpoint in `/search` manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` and `@fastify/cors` was set to `origin: true`, creating a permissive CORS configuration that allows any origin to make authenticated requests and read responses.
**Learning:** When bypassing standard Fastify plugins to manually write response headers (like for SSE), standard CORS validations are bypassed. Furthermore, `origin: true` in `@fastify/cors` reflects any origin, which is insecure for authenticated APIs.
**Prevention:** Always validate origins against an explicitly configured allowed origin (e.g., `FRONTEND_URL` from environment variables) rather than blindly trusting the request `Origin` header. Avoid using `origin: true` in `@fastify/cors` when credentials are included.
