## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-11-09 - Manual SSE Headers Bypass Global CORS Rules
**Vulnerability:** The `/search/ask` SSE endpoint manually reflected `request.headers.origin` in its `Access-Control-Allow-Origin` header instead of using the global `@fastify/cors` plugin settings.
**Learning:** When using `reply.raw.writeHead` for Server-Sent Events, Fastify's global CORS plugin is bypassed. Blindly reflecting `request.headers.origin` or using `*` with credentials creates a severe Cross-Origin Resource Sharing vulnerability, potentially allowing any malicious site to interact with the authenticated API.
**Prevention:** Always dynamically validate the incoming `Origin` against a strict whitelist (e.g., loaded from environment variables) before setting `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` headers on raw responses.
