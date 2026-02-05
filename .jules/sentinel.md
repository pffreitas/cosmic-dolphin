## 2024-05-21 - [CRITICAL] Hardcoded Secrets in Config
**Vulnerability:** The API configuration had a hardcoded default `JWT_SECRET` ("your-secret-key") which was used if the environment variable was missing.
**Learning:** Default values for critical secrets can lead to production vulnerabilities if deployment configuration is missed.
**Prevention:** Enforce strict validation for secrets in production environments, crashing the application if they are missing.
