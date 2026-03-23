## 2024-05-24 - [Hardcoded JWT Secret Fallback]
**Vulnerability:** A hardcoded default value ("your-secret-key") was provided for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Default fallbacks for secrets bypass validation frameworks, causing apps to run with insecure default keys if the environment variable is missing.
**Prevention:** Always use an empty string (`""`) or omit the default for secrets in configuration files so that validation frameworks fail on startup if secrets are missing.
