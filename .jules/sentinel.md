## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.
## 2025-02-14 - Unrestricted SSRF via Web Scraping HTTP Client
**Vulnerability:** The HTTP client (`CosmicHttpClient`) using `got` fetched arbitrary URLs without checking if they resolved to internal network addresses, allowing Server-Side Request Forgery (SSRF) against internal services like metadata endpoints or loopback devices.
**Learning:** Checking hostnames directly using strings or Regex is vulnerable to DNS rebinding (TOCTOU). Comprehensive prevention requires actively resolving the hostname with DNS before the request is issued. Furthermore, when substituting the resolved IP in Node.js HTTPS requests, the TLS `servername` must be preserved or it breaks SNI handshake.
**Prevention:** Always implement a `beforeRequest` hook to resolve hostnames (`dns.lookup`), validate the IP against a blocklist, force the request connection to use the resolved IP (to prevent DNS rebinding), and fail-close if DNS lookup fails.
