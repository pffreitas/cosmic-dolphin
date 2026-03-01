## 2024-05-15 - [CRITICAL] Hardcoded default JWT secret
**Vulnerability:** Hardcoded fallback `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** This exposes the application to token forgery attacks if the environment variable is not set.
**Prevention:** Remove fallback defaults for critical secrets and fail fast on startup if they are missing. Use validation libraries like zod to enforce configuration requirements.
