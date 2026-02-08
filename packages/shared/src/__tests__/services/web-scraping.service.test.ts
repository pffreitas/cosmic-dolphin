import { describe, it, expect } from "@jest/globals";
import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  const service = new WebScrapingServiceImpl();

  describe("isValidUrl", () => {
    it("should return true for valid http URLs", () => {
      expect(service.isValidUrl("http://example.com")).toBe(true);
      expect(service.isValidUrl("http://google.com")).toBe(true);
    });

    it("should return true for valid https URLs", () => {
      expect(service.isValidUrl("https://example.com")).toBe(true);
      expect(service.isValidUrl("https://google.com")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      expect(service.isValidUrl("not-a-url")).toBe(false);
      expect(service.isValidUrl("ftp://example.com")).toBe(false);
      expect(service.isValidUrl("file:///etc/passwd")).toBe(false);
    });

    it("should return false for localhost", () => {
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("http://localhost:3000")).toBe(false);
      expect(service.isValidUrl("https://localhost")).toBe(false);
    });

    it("should return false for private IP addresses", () => {
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://0.0.0.0")).toBe(false);
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(service.isValidUrl("http://172.31.255.255")).toBe(false);
    });

    it("should return false for cloud metadata service", () => {
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false);
    });

    it("should return false for IPv6 loopback", () => {
        expect(service.isValidUrl("http://[::1]")).toBe(false);
    });
  });
});
