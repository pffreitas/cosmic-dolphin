## 2023-10-25 - Overly Permissive CORS Configuration

**Vulnerability:** Fastify CORS was configured with `origin: true` by default, allowing any domain to make cross-origin requests to the API.
**Learning:** Hardcoding permissive CORS configurations creates a significant security risk, especially in production environments, as it bypasses the same-origin policy protections and allows malicious sites to interact with the API on behalf of users.
**Prevention:** Implement a dynamic CORS configuration driven by environment variables (e.g. `CORS_ORIGIN`). If the variable is set to a specific list of domains (comma-separated), split them and allow only those. Defaulting to `*` or `origin: true` should only be done if strictly necessary or explicitly controlled.
