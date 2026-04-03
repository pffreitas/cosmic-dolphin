## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.
## 2024-05-24 - Overly Permissive CORS Configurations
**Vulnerability:** The API allowed any origin by setting `origin: true` in `@fastify/cors` and manually reflecting `request.headers.origin || "*"` in an SSE route.
**Learning:** Using `origin: true` in Fastify or reflecting arbitrary `Origin` headers allows any site to make cross-origin requests, leading to potential Cross-Site Request Forgery (CSRF) or data leakage if credentials are also allowed.
**Prevention:** Always restrict CORS to a specific, configurable list of allowed origins using an environment variable like `CORS_ORIGIN`, and parse it to strictly validate incoming requests.
