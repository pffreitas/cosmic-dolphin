## 2024-05-22 - SSRF Risk in Web Scraping
**Vulnerability:** The `CosmicHttpClient` used for web scraping was vulnerable to SSRF because it resolved DNS without validating the IP address, allowing requests to internal services (localhost, AWS metadata, etc.).
**Learning:** Even robust HTTP clients like `got` do not provide SSRF protection by default. Custom DNS lookup logic is required to validate resolved IPs against private ranges.
**Prevention:** Use the `safeLookup` utility (which wraps `dns.lookup` with `isPrivateIP` checks) for all outbound HTTP requests that fetch user-provided URLs. This pattern should be enforced for any new HTTP client implementations.
