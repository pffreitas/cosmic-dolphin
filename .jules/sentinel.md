## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-04 - Overly Permissive CORS Headers
**Vulnerability:** The application was globally reflecting arbitrary `Origin` headers in its `@fastify/cors` configuration and within manual Server-Sent Events headers in `search.ts`.
**Learning:** Bypassing standard CORS validations or using `origin: true` without explicit trusted domain definitions exposes the API to unauthorized cross-origin requests, especially in endpoints handling sensitive operations.
**Prevention:** Always define an explicit, trusted `FRONTEND_URL` environment variable and use it to strictly validate CORS `Origin` headers instead of blindly reflecting the request's origin.
