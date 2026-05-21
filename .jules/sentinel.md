## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-05-25 - SSRF Protection via URL Normalization
**Vulnerability:** The `isValidUrl` method only checked for `http:` and `https:` protocols, leaving the scraping and preview endpoints vulnerable to Server-Side Request Forgery (SSRF) attacks against internal networks (e.g., `localhost`, `169.254.169.254`).
**Learning:** Using `new URL(url).hostname` automatically normalizes alternative IP representations (e.g., parsing `http://2130706433/` to `127.0.0.1`), making it a reliable mechanism for implementing SSRF blocklists against internal network addresses without needing complex custom IP normalization logic.
**Prevention:** Always validate user-provided URLs against a strict blocklist of internal IP ranges and hostnames using the parsed and normalized `.hostname` property of the `URL` object.
