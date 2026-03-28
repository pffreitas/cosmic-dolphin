## 2024-05-24 - Hardcoded Secret Fallback
**Vulnerability:** A hardcoded string ("your-secret-key") was used as a fallback for `JWT_SECRET` in the environment configuration.
**Learning:** Using a valid-looking string as a fallback for secrets can mask missing environment variables and allow the application to start with insecure credentials. Environment validation frameworks should fail explicitly if secrets are missing.
**Prevention:** Always use an empty string (`""`) as the default fallback for security secrets so that required configuration checks fail securely at startup.
