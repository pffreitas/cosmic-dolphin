## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-04-26 - Insecure CORS Origin Reflection in SSE
**Vulnerability:** The Fastify API allowed any origin by setting origin: true in the CORS plugin and reflected the Request Origin header dynamically in Server-Sent Events (SSE) manual endpoints, enabling Cross-Origin Resource Sharing from malicious domains.
**Learning:** When writing raw headers using Fastify's reply.raw.writeHead for SSE, the standard Fastify CORS plugin is bypassed, meaning origins must be validated manually and securely against an allowed list rather than accepting anything.
**Prevention:** Centralize the allowed frontend URL (e.g., FRONTEND_URL in environment configuration) and explicitly set it as the allowed origin for both the standard Fastify CORS plugin and any manual header responses.
