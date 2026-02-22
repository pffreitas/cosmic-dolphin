# Sentinel's Journal

## 2025-02-18 - SSRF Vulnerability in CosmicHttpClient
**Vulnerability:** The `CosmicHttpClient` (using `got`) allowed fetching resources from any resolved IP, including private networks (localhost, 10.x.x.x, etc.), enabling Server-Side Request Forgery (SSRF).
**Learning:** Even "modern" HTTP clients like `got` do not block private IP ranges by default. When performing web scraping or fetching user-provided URLs, explicit DNS validation is mandatory to prevent SSRF.
**Prevention:** Implement a custom `dnsLookup` function that resolves the hostname, validates the IP address against private ranges (IPv4 and IPv6), and rejects the connection if unsafe. Inject this function into the HTTP client configuration.
