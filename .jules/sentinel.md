## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-05-25 - DNS Rebinding Vulnerability in HTTP Client SSRF Protection
**Vulnerability:** Mitigating SSRF by solely validating the hostname via string matching or initial DNS resolution leaves a Time-Of-Check to Time-Of-Use (TOCTOU) vulnerability where an attacker can rapidly change DNS records after validation but before the request.
**Learning:** Overriding the HTTP client's request hostname with the validated IP address is required to prevent DNS rebinding attacks. However, this causes HTTPS requests to fail due to incorrect Server Name Indication (SNI) during the TLS handshake.
**Prevention:** Override `options.url.hostname` with the validated IP and explicitly set the original hostname in `options.headers.host` and `options.https.servername` to ensure both DNS rebinding protection and valid TLS handshakes.
