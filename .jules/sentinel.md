## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-10-27 - Server-Side Request Forgery via Got DNS Rebinding
**Vulnerability:** The web scraper component, which accepted user-controlled URLs, used the `got` library to fetch content. Even if the initial `url.hostname` was validated against an IP blocklist, the connection process would re-resolve the domain, allowing an attacker to use DNS rebinding (switching a public IP to a private IP after the validation check) to access internal network resources.
**Learning:** Validating hostnames without pinning the resolved IP to the actual request creates a Time-Of-Check to Time-Of-Use (TOCTOU) vulnerability. The HTTP client must be forced to connect to the exact, validated IP address.
**Prevention:** In the `beforeRequest` hook of `got`, manually resolve the DNS, validate the IP against internal ranges, and override `options.url.hostname` with the validated IP. Ensure `options.headers.host` and `options.https.servername` are set to the original hostname to preserve expected HTTP routing and TLS SNI handshakes.
