## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-06-21 - Unrestricted URL Parsing leading to SSRF
**Vulnerability:** The web scraper service parsed user-supplied URLs without restricting requests to internal IP ranges, creating a high-risk SSRF (Server-Side Request Forgery) vulnerability.
**Learning:** Node.js `new URL(url).hostname` automatically normalizes alternative IP representations (like parsing `http://2130706433/` to `127.0.0.1`), making it a reliable mechanism for implementing SSRF blocklists against internal network addresses without complex regex for bypasses.
**Prevention:** Always validate and block local loopbacks, AWS metadata IPs, and private IP ranges (`10.x.x.x`, `172.16.x.x`, `192.168.x.x`) immediately after parsing the URL in any service that fetches external resources on behalf of a user.
