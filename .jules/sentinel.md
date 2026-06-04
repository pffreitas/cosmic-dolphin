## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2026-05-10 - Unrestricted SSRF in Fetch Requests
**Vulnerability:** The HTTP client (`CosmicHttpClient` utilizing `got`) used to fetch external website content lacked SSRF (Server-Side Request Forgery) protection, allowing users to make outbound requests to private networks, loopback addresses, and cloud provider metadata IPs (like `169.254.169.254`).
**Learning:** Checking the URL string against blocklists before making a fetch request is inadequate because DNS resolution can point an external domain to a private internal IP (DNS rebinding) and the network client handles the request. Relying only on `new URL()` validation does not secure against DNS-level SSRF.
**Prevention:** Intercept fetch requests in a pre-request hook (e.g. `got`'s `beforeRequest`), actively resolve the hostname to its underlying IP address, validate the IP against private network ranges, and modify the request's internal target to the resolved IP to prevent Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding. Maintain the original `Host` header and `servername` (for HTTPS/SNI) to ensure TLS connections still work seamlessly.
