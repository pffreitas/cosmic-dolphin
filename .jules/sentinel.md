## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-05-24 - Server-Sent Events Bypassing CORS Plugins
**Vulnerability:** A Server-Sent Events (SSE) endpoint using `reply.raw.writeHead` manually set `"Access-Control-Allow-Origin": request.headers.origin || "*"`, bypassing standard framework CORS protections and creating a permissive CORS vulnerability.
**Learning:** When dropping down to raw Node.js response objects (like `reply.raw`) in frameworks like Fastify to implement SSE or streaming, standard middleware/plugins (like `@fastify/cors`) do not automatically apply their headers. This forces developers to manually implement CORS, often leading to insecure fallback defaults (like reflecting arbitrary origins).
**Prevention:** Always validate origins manually against an environment-configured allowlist (e.g., `FRONTEND_URL`) when using raw response objects, rather than reflecting the request origin or using wildcards.
