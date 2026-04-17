## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-17 - Overly Permissive CORS and Manual Header Bypasses
**Vulnerability:** Fastify CORS was configured with `origin: true` (reflecting any origin) and SSE endpoints manually reflected `request.headers.origin || "*"`.
**Learning:** Manual endpoint implementations (like Server-Sent Events) that bypass standard plugins often require manual application of security headers, creating a secondary surface for CORS misconfigurations alongside plugin misconfigurations.
**Prevention:** Centralize permitted origins in environment variables (e.g., `FRONTEND_URL`) and rigorously enforce strict validation for both plugin configurations and manual headers.
