## 2026-02-06 - Hardcoded Secrets in Default Configuration
**Vulnerability:** Found `JWT_SECRET` defaulting to "your-secret-key" in `apps/api/src/config/environment.ts`. This allows attackers to forge valid JWTs if the environment variable is not set.
**Learning:** Default values in configuration files often become security risks because they provide a false sense of functionality while leaving the application insecure. Developers might forget to set the environment variable because the app "just works".
**Prevention:** Remove insecure default values for sensitive configuration. Use strict validation helper functions (like `requiredEnv`) that throw errors during startup if critical variables are missing, ensuring the application fails securely.
