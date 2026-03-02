## 2024-03-01 - Restrict overly permissive CORS configuration
**Vulnerability:** Fastify CORS was configured with `origin: true` in production, allowing any origin to make cross-origin requests to the API.
**Learning:** Overly permissive CORS configurations (`origin: true` or `origin: "*"`) bypass the same-origin policy, allowing malicious websites to access sensitive user data on behalf of an authenticated user.
**Prevention:** Configure CORS to only allow specific, trusted origins (e.g., the application's frontend domain) using environment variables (e.g., `CORS_ORIGIN`).
