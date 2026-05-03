## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-03 - Restrict Overly Permissive CORS Configuration
**Vulnerability:** The API had an overly permissive CORS configuration. Fastify CORS was set to `origin: true` globally, and the Server-Sent Events (SSE) endpoint manually reflected arbitrary origins (`request.headers.origin || "*"`) while setting `Access-Control-Allow-Credentials: "true"`.
**Learning:** Using overly permissive origins or reflecting arbitrary origins when credentials are allowed is a security risk as it can allow cross-origin requests with credentials from malicious sites. Manual routing logic like SSE bypassing global CORS middleware can easily reintroduce vulnerabilities.
**Prevention:** Always restrict CORS explicitly to trusted origins using `FRONTEND_URL` environment variables, and ensure that manual response headers follow the same strict policies.
