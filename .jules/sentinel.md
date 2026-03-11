## 2024-05-24 - Overly Permissive CORS Configuration
**Vulnerability:** The API had CORS configured with `origin: true`, allowing requests from any origin. This is dangerous as it allows unintended cross-origin data reads and exposes the API to CSRF or CSRF-like data exposure risks in production.
**Learning:** Fastify's CORS plugin defaults to allowing all origins (`*`) if `origin: true` is passed, which can easily be misconfigured as a blanket pass during development and accidentally left in production.
**Prevention:** Use an environment variable like `CORS_ORIGIN` to explicitly define allowed origins (supporting comma-separated values for multiple origins), and ensure the fallback behavior for missing configurations fails securely (e.g., `false`) rather than failing open.
