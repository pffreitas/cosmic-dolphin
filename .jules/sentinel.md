## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.
## 2024-05-27 - SSRF Mitigation in HTTP Client Requires DNS Resolution
**Vulnerability:** The `CosmicHttpClient` used by web scraping services did not validate target URLs, making it vulnerable to Server-Side Request Forgery (SSRF). Attackers could provide internal network addresses (e.g., `127.0.0.1`, `169.254.169.254`) to scan or access internal services.
**Learning:** Simply validating the hostname string against a blocklist is insufficient due to DNS-based bypasses (e.g., `localtest.me` resolving to `127.0.0.1`). True SSRF prevention requires resolving the hostname to an IP address before the request, validating the IP against internal network ranges, and overriding the request's hostname with the validated IP to prevent Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding vulnerabilities, while preserving original SNI via TLS servername and Host headers.
**Prevention:** Always use a pre-request hook to perform DNS resolution, enforce a strict private IP blocklist on the resolved address, and bind the HTTP client request to the validated IP instead of the original hostname.
