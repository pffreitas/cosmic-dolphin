
## 2024-05-18 - Overly Permissive CORS Configuration
**Vulnerability:** Fastify CORS was configured with `origin: true` in `apps/api/src/index.ts`, allowing requests from any origin. This could expose the API to Cross-Site Request Forgery (CSRF) and unwanted cross-origin access.
**Learning:** Default configurations or simple setups often use permissive settings like `origin: true` or `origin: "*"` for ease of development, but this is dangerous in production.
**Prevention:** Always restrict CORS to known, trusted origins by configuring it dynamically via environment variables (e.g., `CORS_ORIGIN`).
