## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-29 - Secure CORS configurations and SSE raw responses
**Vulnerability:** Fastify raw response bypassing plugin CORS controls and reflecting arbitrary origins (`"Access-Control-Allow-Origin": request.headers.origin || "*"`) and wildcard origins on the fastify cors plugin itself (`origin: true`).
**Learning:** Using raw Fastify responses (e.g. for Server-Sent Events) bypasses the global Fastify CORS plugin controls, making endpoints vulnerable to arbitrary cross-origin requests.
**Prevention:** Explicitly validate headers against a trusted source (e.g., `config.FRONTEND_URL`) for raw responses, and do not use `origin: true` for Fastify CORS configurations.
