## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2024-05-30 - Insecure CORS Origin Reflection in SSE Endpoint
**Vulnerability:** Fastify SSE endpoints bypassing standard plugins reflected arbitrary origins (`request.headers.origin || "*"`) in the `Access-Control-Allow-Origin` header, creating an overly permissive CORS configuration.
**Learning:** Manual endpoint implementations (like SSE using `reply.raw.writeHead`) do not automatically inherit security headers from `@fastify/cors` and require explicit, validated origin configuration.
**Prevention:** Always validate `Access-Control-Allow-Origin` headers against a trusted environment variable (e.g., `FRONTEND_URL`) instead of reflecting the request's origin.
