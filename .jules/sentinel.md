## 2026-02-12 - SSRF Protection Implementation
**Vulnerability:** The `WebScrapingService.isValidUrl` method in `packages/shared` allowed local and private IP addresses, enabling Server-Side Request Forgery (SSRF).
**Learning:** `new URL` handles IPv6 by adding brackets, which must be stripped before passing to `net.isIP`. Also, manual checks against RFC 1918 and other reserved ranges are necessary for robust SSRF protection in Node.js.
**Prevention:** Use a dedicated validation function that checks `hostname` against a list of private IP ranges and `localhost` before making any outbound request.
