## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-01 - Fix CORS Origin Reflection
**Vulnerability:** The search route manually handled SSE responses and blindly reflected the `Origin` header (`request.headers.origin || "*"`) into the `Access-Control-Allow-Origin` header, completely bypassing Fastify's CORS plugin and allowing any domain to read the SSE stream. The main Fastify CORS configuration was also overly permissive (`origin: true`).
**Learning:** When manually writing raw responses (like SSE using `reply.raw.writeHead`), standard middleware/plugins (like `@fastify/cors`) may be bypassed, requiring manual and strict validation of security headers. Using wildcard or reflected origins exposes sensitive data to arbitrary domains.
**Prevention:** Always restrict CORS headers to explicitly trusted domains (e.g., via an environment variable like `FRONTEND_URL`) and avoid using `origin: true` or reflecting request origins in production.
