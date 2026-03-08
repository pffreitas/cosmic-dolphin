
## $(date +%Y-%m-%d) - [Overly Permissive CORS]
**Vulnerability:** The Fastify API allowed all origins (`origin: true`) in production, enabling Cross-Origin Resource Sharing (CORS) from any domain.
**Learning:** Default configurations in `@fastify/cors` might expose APIs to unauthorized cross-origin requests.
**Prevention:** Always restrict `origin` based on environment variables like `CORS_ORIGIN` and explicitly deny `*` in production environments.
