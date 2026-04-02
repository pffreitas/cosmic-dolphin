## 2024-05-24 - Overly Permissive CORS in Fastify
**Vulnerability:** The Fastify API was globally registered with `@fastify/cors` using `{ origin: true }`, which permits cross-origin requests from any domain in production.
**Learning:** Hardcoding `origin: true` is convenient for local development but disables vital browser security mechanisms when deployed, leaving APIs susceptible to unauthorized client-side access.
**Prevention:** Use an environment variable like `CORS_ORIGIN` to configure allowed origins dynamically, keeping it strict in production while optionally allowing it in development.
