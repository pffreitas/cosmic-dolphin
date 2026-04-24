## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-24 - Overly Permissive CORS Configuration
**Vulnerability:** Fastify CORS plugin and manual SSE headers reflected arbitrary origins (`"Access-Control-Allow-Origin": request.headers.origin || "*"`) and used `origin: true`.
**Learning:** Using overly permissive CORS configurations exposes the API to Cross-Site Request Forgery (CSRF) and unauthorized access from malicious domains. Manual headers in SSE endpoints bypass plugin-level protections.
**Prevention:** Always restrict `Access-Control-Allow-Origin` to specific, trusted domains (e.g., via a `FRONTEND_URL` environment variable) instead of reflecting the request origin or using wildcards.
