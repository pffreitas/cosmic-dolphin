## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2024-05-30 - SSRF Vulnerability in Got Client DNS Resolution
**Vulnerability:** The HTTP client allowed SSRF via redirects or direct requests to internal IPs (like `127.0.0.1` or `localhost`) since URLs were not validated for internal resolution prior to dispatching requests.
**Learning:** Relying solely on static string or Regex checks against `new URL(url).hostname` is vulnerable to DNS-based bypasses (e.g., `localtest.me` resolving to `127.0.0.1`). Comprehensive prevention requires resolving the hostname to an IP address prior to the request using the `dns` module to check for internal IPs.
**Prevention:** Ensure any server-side HTTP request handlers validate the resolved IP address of the target URL against an internal IP blocklist before performing the request.
