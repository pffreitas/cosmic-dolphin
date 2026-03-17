## 2024-05-18 - Hardcoded Default Secrets Bypass Environment Validation
**Vulnerability:** The API service had a hardcoded default string ("your-secret-key") for `JWT_SECRET` in `src/config/environment.ts`.
**Learning:** Hardcoded default secrets allow services to start without valid configurations. Validation frameworks (like Fastify env plugin or Zod) will consider the variable "present" because of the default, silently succeeding and allowing the app to run with known insecure secrets.
**Prevention:** Always use empty strings `""` for critical secret fallback values instead of insecure string defaults. This ensures validation frameworks and startup checks will fail appropriately when actual secrets are missing from the environment.
