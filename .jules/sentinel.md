## 2026-03-26 - [Hardcoded Secret Default]
**Vulnerability:** Found `your-secret-key` as a fallback default for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Environment configuration files must use an empty string (`""`) instead of insecure hardcoded strings as default fallbacks for secrets to ensure validation frameworks fail appropriately when secrets are missing.
**Prevention:** Always use `""` for secret defaults and rely on environment validation to enforce presence of critical configuration variables at startup.
