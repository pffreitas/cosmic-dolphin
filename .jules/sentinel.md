## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-06-07 - Server-Side Request Forgery (SSRF) and DNS Rebinding
**Vulnerability:** The HTTP client used for fetching bookmark metadata did not validate the resolved IP address of the requested URL, allowing SSRF attacks against internal networks (e.g., `http://127.0.0.1`).
**Learning:** Relying solely on static string or Regex checks against the URL's hostname is vulnerable to DNS-based bypasses. An attacker can set up a custom domain (e.g., `localtest.me`) that resolves to an internal IP.
**Prevention:** Always resolve the hostname to an IP address prior to the request using `dns.lookup`, verify the resolved IP is not internal, and then explicitly override the request URL's hostname to the validated IP to prevent Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding vulnerabilities. Ensure to preserve the original `Host` header and set the `servername` for TLS SNI.
