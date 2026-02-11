## 2025-02-12 - Web Scraping SSRF Vulnerability
**Vulnerability:** The `WebScrapingService.isValidUrl` method only checked for `http/https` protocol, allowing attackers to access internal network resources via `localhost` or private IP addresses (e.g., `http://169.254.169.254` for cloud metadata).
**Learning:** Checking URL format/protocol is insufficient for preventing Server-Side Request Forgery (SSRF). Backend services making outbound requests must validate the destination IP address against private ranges.
**Prevention:** Always resolve and validate hostnames before making requests. Use a strict allowlist for internal services or block private IP ranges (RFC 1918) and `localhost`. In this codebase, `net.isIP` and private range checks were added to `packages/shared`.
