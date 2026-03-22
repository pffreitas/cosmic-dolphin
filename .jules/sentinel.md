## 2024-06-01 - Remove hardcoded JWT_SECRET default fallback
**Vulnerability:** A hardcoded default secret `"your-secret-key"` was used as a fallback for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Using default hardcoded secrets allows validation frameworks to pass even when the actual secret is missing, potentially compromising the application's security. Environment configuration files must use an empty string (`""`) instead of insecure hardcoded strings as default fallbacks for secrets.
**Prevention:** Always use an empty string `""` for missing secrets to ensure validation fails appropriately.
