## 2024-05-24 - Hardcoded Secret Fallback Bypasses Validation Frameworks
**Vulnerability:** A hardcoded fallback value (`"your-secret-key"`) was used for `JWT_SECRET` in `apps/api/src/config/environment.ts`.
**Learning:** Providing fallback values for critical secrets in configuration files causes validation frameworks (like `@fastify/env`) to silently accept the insecure default instead of failing at startup when the environment variable is missing. This masks the missing configuration and deploys the application with a known, insecure secret.
**Prevention:** Always use an empty string (`""`) or omit the fallback entirely for sensitive configuration variables to ensure validation frameworks correctly flag missing secrets during application startup.

## 2026-05-09 - Overly Permissive CORS and Bypassed Validation via SSE
**Vulnerability:** Fastify CORS was set to `origin: true` (reflecting arbitrary origins) and the SSE endpoint manually set `Access-Control-Allow-Origin` to `request.headers.origin || "*"` while allowing credentials, risking unauthorized cross-origin access.
**Learning:** Manual HTTP responses (like `reply.raw.writeHead` for Server-Sent Events) bypass global plugin protections like `@fastify/cors`. Developers must manually apply security headers on these raw endpoints.
**Prevention:** Restrict CORS origins explicitly using a `FRONTEND_URL` environment variable for both global CORS plugins and manual HTTP endpoints, avoiding reflection of arbitrary request origins.

## 2025-10-25 - SSRF Protection in Web Scraping
**Vulnerability:** The application was vulnerable to Server-Side Request Forgery (SSRF) as `isValidUrl` only checked for http/https protocols, allowing requests to internal and private network addresses (like `localhost` or `169.254.169.254`).
**Learning:** Using `new URL()` automatically normalizes some IP representations, but raw IPv6 addresses must be properly bracketed. `isValidUrl` must explicitly block private and internal IP ranges to ensure security in operations fetching remote resources.
**Prevention:** Implement strict SSRF blocklists referencing `urlObj.hostname`, verifying that internal, private (IPv4/IPv6), and loopback addresses are explicitly denied access.

## 2025-10-25 - Advanced SSRF Bypasses in Web Scraping
**Vulnerability:** The initial SSRF mitigation failed to protect against loopback bypasses using alternate subnet representations (e.g., `127.0.0.2` instead of strictly `127.0.0.1`) and 'any' IP representations like `0.0.0.0`. Additionally, a regex attempting to fix unbracketed IPv6 broke credentials parsing in URLs.
**Learning:** Checking strictly for `"127.0.0.1"` is insufficient for SSRF protection because the entire `127.0.0.0/8` subnet routs back to loopback. Furthermore, `0.0.0.0` translates to `127.0.0.1` on Linux/macOS systems. When manipulating URLs to handle edge cases like IPv6 parsing, one must ensure regexes handle the full spectrum of valid URIs (like authentication elements).
**Prevention:** Always block the full 127.x.x.x subnet using regex `/^127\.\d+\.\d+\.\d+$/` and explicitely block `0.0.0.0`. When implementing fallback URL parsing hacks (like bracketing unbracketed IPv6), wrap them in try-catch to attempt native `URL()` parsing first, only applying manual regex intervention if the native parse fails.

## 2025-10-25 - Regex Edge Cases in SSRF Prevention
**Vulnerability:** Initial SSRF mitigation blocked legitimate public domains that started with private IPv4 octets (e.g., `10.example.com` or `192.168.com`) due to overly broad regexes that only checked the prefix (e.g., `/^10\./`).
**Learning:** `new URL()` automatically strips port information from the `hostname` property and parses IPs nicely, but if regex matching is used to check for private IPs on the `hostname`, the pattern must strictly match the start and end of the string. Additionally, Node.js automatically normalizes IPv4-mapped IPv6 representations like `[::ffff:127.0.0.1]` into their hex equivalents like `[::ffff:7f00:1]`.
**Prevention:** When validating IP boundaries with regexes, explicitly define the IP string structure using full dotted-decimal notations bounded by start (`^`) and end (`$`) string anchors (e.g., `/^10\.\d+\.\d+\.\d+$/`). Always test IP validation logic against valid domain names with numeric prefixes to check for false positives, and verify exactly how the language runtime normalizes obscure IP formats.
