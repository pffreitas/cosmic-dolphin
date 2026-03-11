# Sentinel Journal

This journal records CRITICAL security learnings from the Sentinel agent.

## 2026-02-16 - SSRF Vulnerability in Web Scraping
**Vulnerability:** The `WebScrapingService` in `packages/shared` implemented `isValidUrl` which only checked for valid protocol (http/https). This allowed users to potentially access internal network resources via SSRF by inputting `localhost`, `127.0.0.1`, or private IP addresses.
**Learning:** Simple URL validation is insufficient for services that make outbound requests on behalf of users. Always validate the destination IP address against private/reserved ranges.
**Prevention:** Implemented strict IP filtering in `isValidUrl` using `node:net` to block private/reserved IP ranges and localhost.
