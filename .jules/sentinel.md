## 2024-05-22 - [CRITICAL] Server-Side Request Forgery (SSRF) in Web Scraper
**Vulnerability:** The `WebScrapingService` (via `CosmicHttpClient`) allowed users to request any URL, including internal IP addresses (localhost, 127.0.0.1, private ranges). This could lead to access to internal services or metadata.
**Learning:** Even when using robust HTTP clients like `got`, they do not automatically protect against SSRF. Explicit DNS validation or IP filtering is required.
**Prevention:** Implemented `safeLookup` function using `dns.lookup` and `isSafeIp` to validate resolved IP addresses before connection. Used `dnsLookup` hook in `got` to enforce this check.
