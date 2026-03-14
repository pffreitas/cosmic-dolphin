## 2024-05-18 - [CRITICAL] Hardcoded JWT Secret Fallback
**Vulnerability:** Defaulting `JWT_SECRET` to `"your-secret-key"` in `environment.ts`.
**Learning:** Providing insecure default fallbacks for secrets bypasses validation frameworks (like Fastify env) which expect missing values to fail startup.
**Prevention:** Always default secrets to `""` or `undefined` so that required environment variable checks fail securely when secrets are missing.
