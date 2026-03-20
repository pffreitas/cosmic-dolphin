## 2024-03-20 - [Removed Hardcoded JWT Secret]
**Vulnerability:** A hardcoded default value (`"your-secret-key"`) was used as a fallback for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Using predictable or hardcoded defaults for sensitive keys bypasses environment validation and can accidentally expose the application if variables are misconfigured in production.
**Prevention:** Default secrets to empty strings (`""`) so that environment validation frameworks (like `@fastify/env`) fail immediately at startup instead of running insecurely.
