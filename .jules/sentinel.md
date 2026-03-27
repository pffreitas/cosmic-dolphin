# Sentinel Journal 🛡️

## 2026-02-09 - WebScrapingService SSRF Vulnerability
**Vulnerability:** The `isValidUrl` method in `WebScrapingService` only checked for http/https protocols but did not validate the hostname, allowing requests to private IPs and localhost.
**Learning:** `new URL()` does not automatically block private IPs. Simply checking the protocol is insufficient for SSRF protection in scraping features. Also learned that `packages/shared` tests require a database connection by default, which can be bypassed with `SKIP_DB=true` after patching `setup.ts`.
**Prevention:** Always validate hostnames against a blocklist of private IP ranges and localhost when implementing URL fetchers. Use explicit IP validation libraries or robust regex patterns.
