## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2025-06-09 - Prevent SSRF with IP Blocklist, DNS Rebinding Mitigations, and Fail-Closed
**Vulnerability:** A Server-Side Request Forgery (SSRF) vulnerability existed in `packages/shared/src/services/http-client.ts`, allowing an attacker to scrape or query internal systems (e.g., 127.0.0.1, 169.254.169.254 metadata endpoints, or 0.0.0.0). Additionally, there was a risk of DNS rebinding attacks and fail-open logic on DNS resolution errors.
**Learning:** Checking the hostname directly against a list is insufficient because attackers can use DNS rebinding (TOCTOU) or IP representations like 0.0.0.0 to bypass checks. Furthermore, allowing the default client to handle DNS lookup failures can enable attackers to force a fail-open scenario where an external lookup times out but an internal one succeeds.
**Prevention:** Always perform a DNS lookup (`dns.lookup`) to validate the resolved IP address. Block internal IP addresses (including 0.0.0.0), replace the request hostname with the validated IP address to prevent TOCTOU, preserve the original Host and SNI headers, and ensure any DNS resolution failure explicitly throws an error (fail closed).
