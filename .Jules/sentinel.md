## 2024-03-24 - [Fix Hardcoded Secret and Permissive CORS]
**Vulnerability:** The API service contained a hardcoded fallback secret (`"your-secret-key"`) for `JWT_SECRET` and configured `@fastify/cors` with `origin: true`, allowing all origins.
**Learning:** Hardcoded default secrets can lead to token forgery if environment variables are missing. Permissive CORS (`origin: true`) negates same-origin policy protections and can allow unauthorized domains to make cross-origin requests.
**Prevention:** Always default missing secrets to empty strings (`""`) so validation frameworks fail fast. Use a configurable `CORS_ORIGIN` environment variable (supporting comma-separated values) to restrict origins dynamically based on the environment.
