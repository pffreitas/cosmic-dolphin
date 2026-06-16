## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-06-16 - Prevent SSRF with DNS Pinning in Node.js Got Client
**Vulnerability:** The HTTP Client was blindly accepting user-provided URLs and passing them directly to the `got` library, creating a Server-Side Request Forgery (SSRF) vulnerability. An attacker could exploit this to scan internal networks, access cloud instance metadata (e.g. `169.254.169.254`), or bypass authentication to internal services (e.g. `localhost`).
**Learning:** Validating the hostname before the request is insufficient due to Time-Of-Check to Time-Of-Use (TOCTOU) DNS Rebinding vulnerabilities. Furthermore, Node.js `got` ignores `options.hostname` overrides and reassignment of `options.url` in `beforeRequest`; the properties of `options.url` must be mutated directly (e.g., `options.url.hostname = ip;`).
**Prevention:** I implemented DNS pinning by resolving the hostname, asserting the resolved IP is not a private or link-local address, and then mutating `options.url.hostname` with the validated IP address while injecting the original hostname into `options.headers.host` and `options.https.servername` (for SNI).
