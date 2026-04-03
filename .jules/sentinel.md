## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-06-05 - Permissive CORS Configuration
**Vulnerability:** The Fastify CORS plugin was configured with `origin: true`, allowing cross-origin requests from any domain, which poses a severe risk in production environments.
**Learning:** Using `origin: true` bypasses origin validation, potentially allowing malicious sites to make authenticated requests on behalf of users.
**Prevention:** Always restrict CORS origins using an environment variable (`CORS_ORIGIN`), allowing either a specific comma-separated list of trusted origins or explicitly using `*` for public APIs.
