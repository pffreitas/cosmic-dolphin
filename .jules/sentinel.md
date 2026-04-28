## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-28 - Overly Permissive CORS Configuration
**Vulnerability:** The API allowed arbitrary origins for Server-Sent Events by reflecting the `request.headers.origin` and using `origin: true` in `@fastify/cors`.
**Learning:** Using overly permissive CORS configurations exposes the application to Cross-Site Request Forgery (CSRF) and other attacks by allowing malicious sites to read sensitive data.
**Prevention:** Always restrict CORS to known, trusted origins by strictly validating the origin against an environment variable like `FRONTEND_URL`.
