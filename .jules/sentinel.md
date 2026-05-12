## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2026-05-12 - Unrestricted URL Fetching Leading to SSRF
**Vulnerability:** The web scraping service accepted any syntactically valid HTTP/HTTPS URL, allowing users to request internal network addresses (like `localhost` or cloud metadata at `169.254.169.254`).
**Learning:** Using `new URL()` alone only validates syntax. Node.js automatically normalizes alternative IP formats (e.g., `http://2130706433/` becomes `127.0.0.1`), meaning we can reliably check the parsed `hostname` property against known private/internal ranges to prevent Server-Side Request Forgery.
**Prevention:** Always validate parsed URL hostnames against a blocklist of local domains, IPv4 private blocks, and IPv6 local/ULA addresses before making outbound HTTP requests on behalf of users.
