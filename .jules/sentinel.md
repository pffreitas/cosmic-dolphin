## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-30 - Insecure CORS Reflection By-Passing Plugin Configurations
**Vulnerability:** The SSE endpoint (`/search/ask`) was reflecting the `Origin` header directly (`request.headers.origin || "*"`) into the `Access-Control-Allow-Origin` response header, completely bypassing the standard `@fastify/cors` plugin configuration.
**Learning:** When manually writing raw responses (e.g., using `reply.raw.writeHead` for Server-Sent Events), Fastify's standard CORS plugin logic is bypassed. If a developer dynamically reflects the incoming `Origin` header without validation, they inadvertently create an overly permissive CORS policy that allows any site to read sensitive responses.
**Prevention:** Always use explicit, trusted origins (e.g., `config.FRONTEND_URL`) when setting CORS headers manually, rather than reflecting user-controlled input. Ensure environment configurations enforce a single source of truth for allowed frontend origins.
