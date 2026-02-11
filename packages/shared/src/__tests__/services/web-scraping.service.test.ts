import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingService", () => {
  let service: WebScrapingServiceImpl;

  beforeEach(() => {
    service = new WebScrapingServiceImpl();
  });

  describe("isValidUrl", () => {
    it("should return true for valid public URLs", () => {
      expect(service.isValidUrl("https://example.com")).toBe(true);
      expect(service.isValidUrl("http://google.com")).toBe(true);
      expect(service.isValidUrl("https://sub.domain.co.uk/path?query=1")).toBe(
        true,
      );
    });

    it("should return false for invalid URLs", () => {
      expect(service.isValidUrl("not-a-url")).toBe(false);
      expect(service.isValidUrl("ftp://example.com")).toBe(false);
    });

    // This is the vulnerability reproduction
    it("should return false for localhost and private IPs", () => {
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false); // Cloud metadata
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://[::1]")).toBe(false);
    });
  });
});
