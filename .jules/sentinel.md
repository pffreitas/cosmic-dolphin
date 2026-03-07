## 2026-03-07 - [Fix] Overly Permissive CORS Configuration
**Vulnerability:** The API CORS configuration hardcoded `origin: true`, allowing any domain to interact with the API.
**Learning:** Hardcoding `origin: true` in production environments poses a security risk. By making it configurable via an environment variable, production apps can enforce a strict allowlist.
**Prevention:** Always default to restrictive CORS and allow configuration via environment variables.
