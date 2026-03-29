import { describe, it, expect } from "@jest/globals";
import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  const service = new WebScrapingServiceImpl();

  describe("isValidUrl", () => {
    it("should return true for valid public URLs", () => {
      expect(service.isValidUrl("https://google.com")).toBe(true);
      expect(service.isValidUrl("http://example.com/foo/bar")).toBe(true);
      expect(service.isValidUrl("https://www.openai.com")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      expect(service.isValidUrl("not-a-url")).toBe(false);
      expect(service.isValidUrl("ftp://example.com")).toBe(false);
      expect(service.isValidUrl("file:///etc/passwd")).toBe(false);
    });

    it("should return true for public domains starting with private IP prefixes", () => {
      expect(service.isValidUrl("http://10.com")).toBe(true);
      expect(service.isValidUrl("http://172.16.net")).toBe(true);
      expect(service.isValidUrl("http://192.168.org")).toBe(true);
      expect(service.isValidUrl("http://127.0.0.1.nip.io")).toBe(true); // Should resolve via DNS, so we can't synchronously block this
    });

    it("should return false for localhost (SSRF)", () => {
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("http://localhost:3000")).toBe(false);
    });

    it("should return false for private IPv4 addresses (SSRF)", () => {
      // Loopback
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1:8080")).toBe(false);

      // Private networks
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://10.255.255.255")).toBe(false);

      expect(service.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(service.isValidUrl("http://172.31.255.255")).toBe(false);

      expect(service.isValidUrl("http://192.168.0.1")).toBe(false);
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
      expect(service.isValidUrl("http://192.168.255.255")).toBe(false);

      // Link-local
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false); // Cloud metadata
      expect(service.isValidUrl("http://169.254.0.1")).toBe(false);
    });

    it("should return false for IPv6 private addresses (SSRF)", () => {
      expect(service.isValidUrl("http://[::1]")).toBe(false); // Loopback
      expect(service.isValidUrl("http://[fc00::1]")).toBe(false); // Unique Local
      expect(service.isValidUrl("http://[fe80::1]")).toBe(false); // Link Local
    });
  });
});
