## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-06-08 - SSRF Vulnerability in Got HTTP Client
**Vulnerability:** The `CosmicHttpClient` used unconstrained requests via the `got` library, allowing users to provide URLs that map to internal services (e.g., `http://localhost:3000`, `http://127.0.0.1`), leading to Server-Side Request Forgery (SSRF) vulnerabilities.
**Learning:** Relying solely on `new URL(url).hostname` checks is insufficient as it is vulnerable to DNS rebinding (Time-Of-Check to Time-Of-Use). You must resolve the IP address, validate it against a blocklist, and explicitly override the request URL's hostname with the validated IP while preserving the original `Host` and TLS `servername` to prevent SNI errors.
**Prevention:** Implement a `beforeRequest` hook in the HTTP client to explicitly perform a DNS lookup, enforce an IP blocklist against private/internal IP ranges, and securely structure the request using the resolved IP.
