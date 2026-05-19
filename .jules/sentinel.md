## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-05-19 - SSRF Vulnerability in URL validation
**Vulnerability:** Server-Side Request Forgery (SSRF) allowed internal network access because `WebScrapingServiceImpl.isValidUrl` only checked if the URL protocol was HTTP/HTTPS.
**Learning:** `new URL(url).hostname` automatically parses decimal IP representations (like `http://2130706433/` -> `127.0.0.1`), making it reliable for blocking malicious network access. Additionally, wrapping `new URL()` in a `try/catch` serves as a safe default by automatically throwing `ERR_INVALID_URL` for unbracketed raw IPv6 addresses.
**Prevention:** Always validate hostnames against a blocklist of internal networks (localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, etc) before fetching data. Rely on `new URL().hostname` for accurate IP normalisation instead of raw string parsing.
