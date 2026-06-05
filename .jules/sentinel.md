## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2026-05-10 - Server-Side Request Forgery via DNS Rebinding
**Vulnerability:** The web scraper (`CosmicHttpClient`) allowed fetching arbitrary URLs without resolving them first, which bypassed basic string validation and allowed DNS rebinding to internal IPs (like `localtest.me` resolving to `127.0.0.1`).
**Learning:** Mitigating SSRF requires resolving hostnames to IP addresses prior to making the request, rather than just parsing the URL. Overriding the request URL's hostname with the validated IP is necessary to prevent TOCTOU (Time-Of-Check to Time-Of-Use) vulnerabilities while correctly setting the TLS `servername`.
**Prevention:** Always use `dns.lookup` to resolve hostnames before making HTTP requests and block any requests attempting to access internal or loopback IP ranges.
