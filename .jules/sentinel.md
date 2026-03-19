## 2024-03-19 - Removed Hardcoded JWT Secret Default Fallback
**Vulnerability:** A hardcoded default JWT secret string ("your-secret-key") was used as a fallback for the `JWT_SECRET` environment variable in `apps/api/src/config/environment.ts`.
**Learning:** Using a string fallback for required secrets causes validation frameworks to falsely pass even if the environment variable is missing, exposing the application to default-key attacks.
**Prevention:** Always default sensitive environment variables (like secrets or API keys) to an empty string `""` instead of a hardcoded mock string. This ensures that initialization fails fast and loudly when secrets are misconfigured.
