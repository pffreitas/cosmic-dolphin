import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  let webScrapingService: WebScrapingServiceImpl;

  beforeEach(() => {
    webScrapingService = new WebScrapingServiceImpl();
  });

  describe("isValidUrl", () => {
    it("should return true for valid public URLs", () => {
      expect(webScrapingService.isValidUrl("https://example.com")).toBe(true);
      expect(webScrapingService.isValidUrl("http://google.com")).toBe(true);
      expect(webScrapingService.isValidUrl("https://subdomain.example.co.uk/path")).toBe(true);
    });

    it("should return false for localhost", () => {
      expect(webScrapingService.isValidUrl("http://localhost")).toBe(false);
      expect(webScrapingService.isValidUrl("https://localhost:3000")).toBe(false);
    });

    it("should return false for loopback IP (127.0.0.1)", () => {
      expect(webScrapingService.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://127.0.0.1:8080")).toBe(false);
    });

    it("should return false for private IP ranges (10.x.x.x)", () => {
      expect(webScrapingService.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://10.255.255.255")).toBe(false);
    });

    it("should return false for private IP ranges (172.16-31.x.x)", () => {
      expect(webScrapingService.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://172.31.255.255")).toBe(false);
    });

    it("should return false for private IP ranges (192.168.x.x)", () => {
      expect(webScrapingService.isValidUrl("http://192.168.0.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://192.168.1.1")).toBe(false);
    });

    it("should return false for link-local addresses (169.254.x.x)", () => {
      expect(webScrapingService.isValidUrl("http://169.254.169.254")).toBe(false);
    });

    it("should return false for IPv6 loopback", () => {
      expect(webScrapingService.isValidUrl("http://[::1]")).toBe(false);
    });

    it("should return false for invalid URL formats", () => {
      expect(webScrapingService.isValidUrl("not-a-url")).toBe(false);
      expect(webScrapingService.isValidUrl("ftp://example.com")).toBe(false); // Only http/https allowed
    });
  });
});
