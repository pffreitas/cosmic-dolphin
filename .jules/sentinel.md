# Sentinel's Journal

## 2026-02-04 - SSRF Vulnerability in HTTP Client
**Vulnerability:** The `CosmicHttpClient` used `got` to fetch URLs without validating the destination IP address, allowing SSRF attacks against internal network (localhost, 127.0.0.1, 169.254.169.254).
**Learning:** `got` library allows a custom `dnsLookup` function which is the correct place to implement SSRF protection to prevent TOCTOU attacks.
**Prevention:** Always validate resolved IP addresses against private ranges before establishing a connection. Use a custom DNS lookup wrapper.
