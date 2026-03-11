import { describe, it, expect } from "@jest/globals";
import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  const service = new WebScrapingServiceImpl();

  describe("isValidUrl - Security Check", () => {
    it("should reject localhost", () => {
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("https://localhost:3000")).toBe(false);
    });

    it("should reject loopback IP addresses", () => {
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1:8080")).toBe(false);
      expect(service.isValidUrl("http://[::1]")).toBe(false);
    });

    it("should reject private IP addresses", () => {
      // 10.0.0.0/8
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://10.255.255.255")).toBe(false);

      // 172.16.0.0/12
      expect(service.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(service.isValidUrl("http://172.31.255.255")).toBe(false);

      // 192.168.0.0/16
      expect(service.isValidUrl("http://192.168.0.1")).toBe(false);
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
    });

    it("should reject link-local addresses", () => {
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false); // AWS metadata
    });

    it("should accept valid public URLs", () => {
      expect(service.isValidUrl("http://example.com")).toBe(true);
      expect(service.isValidUrl("https://google.com")).toBe(true);
      expect(service.isValidUrl("https://8.8.8.8")).toBe(true); // Public DNS
    });
  });
});
