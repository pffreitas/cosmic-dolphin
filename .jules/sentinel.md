## 2024-05-22 - Strict Environment Validation

**Vulnerability:** Application allowed missing critical configuration (JWT_SECRET) or provided insecure defaults, risking security breaches.

**Learning:** Using `zod` schema validation for `process.env` ensures type safety and fail-fast behavior at startup. However, tests running in isolation (e.g., `bun test`) may not load environment variables automatically, requiring explicit `--env-file` flags or test setup adjustments.

**Prevention:** Always validate critical environment variables at application startup. Use a centralized configuration module that throws errors immediately. Ensure test environments mirror production requirements or have explicit mocks/dummy values.
