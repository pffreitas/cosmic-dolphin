## 2024-05-18 - [CRITICAL] Insecure Secret Fallbacks By-passing Validation

**Vulnerability:** Hardcoded strings were used as default fallbacks for secrets (e.g. `JWT_SECRET: process.env.JWT_SECRET || "your-secret-key"`) in `apps/api/src/config/environment.ts`.
**Learning:** Using insecure fallback strings for secrets bypasses validation frameworks (like `@fastify/env`), potentially causing the application to start with insecure configuration.
**Prevention:** Environment configuration files must use an empty string (`""`) instead of insecure hardcoded strings as default fallbacks for secrets to ensure validation frameworks fail appropriately when secrets are missing.
