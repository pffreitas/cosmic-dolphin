## 2024-05-24 - [Environment Variable Defaults]
**Vulnerability:** Environment configuration defaults used hardcoded strings (`"your-secret-key"`) for critical secrets like `JWT_SECRET`.
**Learning:** Defaulting to a hardcoded string causes validation frameworks to pass even when critical secrets are missing from the environment, leading to the use of a known, insecure secret in production.
**Prevention:** Always use empty strings (`""`) as defaults for secrets so that validation frameworks (like Fastify env) fail loudly at startup if the secret is missing.
