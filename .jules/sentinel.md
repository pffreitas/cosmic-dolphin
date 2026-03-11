## 2024-05-22 - SSRF in Web Scraping
**Vulnerability:** The `WebScrapingService` allowed users to input `localhost` and private IP addresses as bookmark URLs. This could be exploited to scan the internal network (SSRF) or access cloud metadata services.
**Learning:** `URL.hostname` for IPv6 addresses includes brackets (e.g., `[::1]`) in the WHATWG URL standard, but Node.js `net.isIP` returns 0 (invalid) for bracketed IPv6 literals. This created a bypass where `net.isIP` failed to detect the IP, allowing the request to proceed.
**Prevention:** Always strip brackets from IPv6 hostnames before validation or use a dedicated library that handles normalization. Always strictly validate user-provided URLs against a whitelist or blacklist of private ranges before fetching.
