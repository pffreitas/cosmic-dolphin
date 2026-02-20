## 2024-05-21 - SSRF Bypass via Bracketed IPv6
**Vulnerability:** A standard `net.isIP()` check failed to detect bracketed IPv6 addresses (e.g., `[::1]`) returned by `URL.hostname`, allowing attackers to bypass SSRF protection.
**Learning:** `URL.hostname` returns bracketed IPv6 literals, but `net.isIP` returns `0` (false) for them. This discrepancy creates a bypass where the validation function considers the hostname a "domain" (safe) while the HTTP client resolves it as a loopback IP.
**Prevention:** Always strip brackets from IPv6 hostnames before validating with `net.isIP`: `hostname.replace(/^\[|\]$/g, '')`.
