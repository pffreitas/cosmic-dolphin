## 2024-03-05 - Overly Permissive CORS Configuration
**Vulnerability:** Fastify CORS plugin is configured with `origin: true` in `apps/api/src/index.ts`, allowing requests from any origin.
**Learning:** Hardcoding permissive CORS policies exposes the API to CSRF-like attacks and data exposure when deployed to production. This setup failed to separate development convenience from production security.
**Prevention:** Use an environment variable (like `CORS_ORIGIN`) to specify allowed origins. Allow it to be comma-separated for multiple origins, and fallback to `origin: true` only when explicitly in development or if configured securely.
