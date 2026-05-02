## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-02 - Overly Permissive CORS Configuration
**Vulnerability:** The API allowed arbitrary origins for CORS (`origin: true` and reflecting `request.headers.origin`), which could potentially expose the API to cross-origin attacks.
**Learning:** Manual endpoint headers (like SSE) bypass standard Fastify CORS plugins and must be validated manually against trusted origins.
**Prevention:** Explicitly configure trusted origins using a centralized environment variable (e.g., `FRONTEND_URL`) for both plugin configurations and manual header responses.
