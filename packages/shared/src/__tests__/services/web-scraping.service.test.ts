import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  const service = new WebScrapingServiceImpl();

  describe("isValidUrl", () => {
    // Valid public URLs
    test("should return true for valid public URLs", () => {
      expect(service.isValidUrl("https://example.com")).toBe(true);
      expect(service.isValidUrl("http://google.com")).toBe(true);
      expect(service.isValidUrl("https://sub.domain.co.uk/path?query=1")).toBe(true);
    });

    // Invalid URLs
    test("should return false for invalid URLs", () => {
      expect(service.isValidUrl("not-a-url")).toBe(false);
      expect(service.isValidUrl("ftp://example.com")).toBe(false); // Only http/https allowed
    });

    // SSRF Vectors - should be blocked
    test("should return false for localhost", () => {
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("http://localhost:3000")).toBe(false);
      expect(service.isValidUrl("http://sub.localhost")).toBe(false);
    });

    test("should return false for private IPv4 addresses", () => {
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1:8080")).toBe(false);
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
      expect(service.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false);
    });

    test("should return false for specific IPv6 loopback", () => {
        // Just checking basic IPv6 loopback
        expect(service.isValidUrl("http://[::1]")).toBe(false);
    });
  });
});
