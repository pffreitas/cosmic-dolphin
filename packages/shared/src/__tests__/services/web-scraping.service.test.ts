import { describe, it, expect, beforeEach } from "@jest/globals";
import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  let service: WebScrapingServiceImpl;

  beforeEach(() => {
    service = new WebScrapingServiceImpl();
  });

  describe("isValidUrl", () => {
    it("should return true for valid public URLs", () => {
      expect(service.isValidUrl("https://google.com")).toBe(true);
      expect(service.isValidUrl("http://example.com/page")).toBe(true);
      expect(service.isValidUrl("https://sub.domain.co.uk")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      expect(service.isValidUrl("ftp://example.com")).toBe(false);
      expect(service.isValidUrl("not-a-url")).toBe(false);
      expect(service.isValidUrl("file:///etc/passwd")).toBe(false);
    });

    it("should return false for private IP addresses (SSRF protection)", () => {
      // These currently pass in the vulnerable implementation, but should fail
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://0.0.0.0")).toBe(false);
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false);
    });

    it("should return false for localhost with port", () => {
      expect(service.isValidUrl("http://localhost:3000")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1:8080")).toBe(false);
    });
  });
});
