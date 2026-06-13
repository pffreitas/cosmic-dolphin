## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-05-27 - DNS Rebinding SSRF via HTTP Clients
**Vulnerability:** The HTTP client wrappers (like `got`) used for scraping resolved URLs without verifying if the final IP belonged to an internal or cloud metadata network (e.g., `127.0.0.1`, `169.254.169.254`).
**Learning:** Checking hostnames or IPs before making the request is insufficient due to Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding vulnerabilities. Attackers can configure DNS records to resolve to a benign IP during validation, but switch to an internal IP during the actual fetch.
**Prevention:** Intercept the request at the network level (e.g., via `beforeRequest` hooks), manually resolve the DNS, validate the IP against a blocklist, and explicitly override the request's hostname to the validated IP while restoring original `Host` headers and TLS Server Name Indication (SNI).
