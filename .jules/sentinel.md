# Sentinel Journal

## 2024-05-22 - [Environment Configuration Hardening]
**Vulnerability:** The `apps/api` service was configured with default fallbacks for critical secrets (e.g., `JWT_SECRET = "your-secret-key"`), which could lead to insecure deployments if environment variables are missing.
**Learning:** Application startup should fail fast when critical configuration is missing rather than falling back to insecure defaults.
**Prevention:** Implemented strict schema validation using `zod` in `config/environment.ts` to enforce presence and minimum strength (e.g., min length) of secrets at startup.
