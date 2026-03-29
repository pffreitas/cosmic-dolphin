## 2024-05-20 - Missing Default Fallback for Secrets in Environment
**Vulnerability:** Found insecure hardcoded string `"your-secret-key"` as default fallback for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Default fallbacks for secrets must be empty strings (`""`) to ensure validation frameworks fail appropriately when secrets are missing instead of falling back to easily guessable values.
**Prevention:** Review environment configuration files and replace string defaults for any secret values with `""`.
