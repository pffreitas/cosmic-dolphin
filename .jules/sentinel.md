# Sentinel's Journal

## 2024-02-27 - Hardcoded JWT Secret Remediation
**Vulnerability:** A hardcoded default value (`"your-secret-key"`) for `JWT_SECRET` was present in `apps/api/src/config/environment.ts`. This allowed the application to start with a known, insecure secret if the environment variable was missing.
**Learning:** Default values for critical security configuration (like secrets) should never be used, as they can silently mask misconfigurations and lead to production vulnerabilities.
**Prevention:** Use runtime validation (e.g., `zod`) to enforce the presence and strength of security-critical environment variables. Fail fast (exit process) if they are missing or weak.
