## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-06-06 - SSRF Protection via DNS Resolution and IP Override
**Vulnerability:** Server-Side Request Forgery (SSRF) vulnerabilities can occur when fetching user-provided URLs. Specifically, using string matching on the domain name is vulnerable to DNS rebinding, where a public domain dynamically resolves to an internal IP (like 127.0.0.1) after initial validation, creating a Time-Of-Check to Time-Of-Use (TOCTOU) vulnerability.
**Learning:** Checking the domain string against a blocklist is insufficient because external domains can resolve to internal IPs. Validating the resolved IP address and then allowing the HTTP client to use the original hostname still leaves the request vulnerable to DNS rebinding if the HTTP client performs its own DNS lookup.
**Prevention:** Always resolve the hostname to an IP address before the request, validate the resolved IP against a blocklist of private IP ranges, and then override the request URL's hostname with the validated IP address. Crucially, preserve the original `Host` header and the TLS `servername` (SNI) to ensure HTTPS works correctly.
