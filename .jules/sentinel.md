## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.
## 2026-06-15 - SSRF Vulnerability in CosmicHttpClient
**Vulnerability:** The CosmicHttpClient, used for fetching data from URLs (e.g. for bookmarks or scraping), uses `got` without any restrictions on the URLs being accessed. This allows an attacker to supply a URL pointing to internal services (e.g., `http://127.0.0.1:3000/`, `http://169.254.169.254/`, or resolving to local IPs via DNS rebinding) and access them through the application, leading to a Server-Side Request Forgery (SSRF) vulnerability.
**Learning:** Even when using a robust HTTP client like `got`, we need to explicitly validate and restrict outbound requests to ensure they do not target internal networks or local hostnames.
**Prevention:** Implement a pre-request hook that parses the URL, performs DNS resolution, checks the resolved IP against a blocklist of internal/private IP ranges, and overrides the hostname while preserving the original `Host` header and `servername` (for SNI). Ensure we fail closed on DNS resolution errors.
