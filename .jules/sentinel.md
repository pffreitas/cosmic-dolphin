## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2025-04-06 - Overly Permissive CORS Configuration
**Vulnerability:** The API Fastify server configured `@fastify/cors` with `origin: true`, allowing any domain to make cross-origin requests.
**Learning:** Defaulting to `origin: true` bypasses the Same-Origin Policy protections, which is a critical security risk (CORS misconfiguration).
**Prevention:** Always restrict CORS origins using a configuration variable (e.g., `CORS_ORIGIN`), defaulting to secure specific origins in development/production, rather than an unconstrained wildcard or `true`.
