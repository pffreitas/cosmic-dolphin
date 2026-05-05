## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-05 - Overly Permissive CORS Configurations
**Vulnerability:** The API had overly permissive CORS configurations (`origin: true` and `request.headers.origin || "*"`), allowing any website to make requests and read responses.
**Learning:** Relying on standard plugin defaults or reflecting arbitrary origin headers bypasses CORS protections and exposes the API to cross-origin resource sharing vulnerabilities.
**Prevention:** Always restrict CORS to explicit, trusted frontend URLs (e.g., using a `FRONTEND_URL` environment variable) instead of allowing all origins.
