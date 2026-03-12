## 2024-05-24 - Overly Permissive CORS Configuration
**Vulnerability:** The Fastify API had `origin: true` configured in `@fastify/cors`, exposing it to potentially malicious cross-origin requests.
**Learning:** Default configurations in the Fastify boilerplate were overly permissive.
**Prevention:** Always configure `CORS_ORIGIN` dynamically via environment variables, defaulting to a secure restriction or environment-specific values (e.g., `'*'` strictly only for development).