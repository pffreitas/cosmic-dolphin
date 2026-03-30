## 2024-05-14 - Overly Permissive CORS Configuration
**Vulnerability:** The Fastify API registered the `@fastify/cors` plugin with `origin: true`, allowing cross-origin requests from *any* domain.
**Learning:** Hardcoding `origin: true` leaves the API vulnerable to Cross-Site Request Forgery (CSRF) and unwanted access. Production APIs should strictly limit allowed origins.
**Prevention:** Use an environment variable like `CORS_ORIGIN` to configure allowed domains dynamically. Parse comma-separated lists to support multiple trusted origins in production, defaulting to secure settings.
