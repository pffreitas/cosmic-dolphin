## 2026-03-07 - [Fix] Overly Permissive CORS Configuration
**Vulnerability:** The API CORS configuration hardcoded `origin: true`, allowing any domain to interact with the API.
**Learning:** Hardcoding `origin: true` in production environments poses a security risk. By making it configurable via an environment variable, production apps can enforce a strict allowlist.
**Prevention:** Always default to restrictive CORS and allow configuration via environment variables.
## 2026-03-07 - [Fix] Mock Interfaces for Testing
**Vulnerability:** TypeScript mock interfaces in `packages/shared` were missing newly added repository methods, causing compilation errors during CI tests.
**Learning:** When updating interfaces in `packages/shared` (like Repositories), their corresponding `jest.Mocked<T>` objects in test files must be updated with mocked implementations (e.g., `jest.fn()`) for the new methods to prevent TypeScript compilation errors (TS2352) during test runs.
**Prevention:** Always run full test suite (including type checking) locally before submitting a PR to catch mock interface mismatches.
