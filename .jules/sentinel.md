## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2025-03-01 - SSRF via TOCTOU DNS Rebinding in HTTP Clients
**Vulnerability:** The HTTP client used for web scraping (`CosmicHttpClient`) did not validate if target URLs resolved to internal network addresses (SSRF), allowing potential internal network scanning or metadata service access.
**Learning:** When mitigating SSRF vulnerabilities using HTTP clients like `got`, simply validating the hostname's resolved IP in a pre-request hook leaves a Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding vulnerability.
**Prevention:** You must override the request URL's hostname with the validated IP (`options.url.hostname = lookupResult.address`) and manually preserve the original `Host` header (`options.headers.host = originalHostname`) to secure the actual connection.
