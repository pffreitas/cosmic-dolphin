## 2024-05-23 - SSRF Prevention in Shared HTTP Client
**Vulnerability:** The shared `CosmicHttpClient` was vulnerable to Server-Side Request Forgery (SSRF) because it allowed fetching any URL without validation, potentially exposing internal services or metadata endpoints (e.g., AWS IMDS).
**Learning:** `got` library provides a `dnsLookup` hook that can be used to validate the resolved IP address before the connection is established. This is a robust way to prevent SSRF at the network level.
**Prevention:** Implemented a `safeLookup` function that checks resolved IPs against private ranges (IPv4 and IPv6) and integrated it into `CosmicHttpClient`.
