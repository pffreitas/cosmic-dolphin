import { WebScrapingServiceImpl } from "../../services/web-scraping.service";

describe("WebScrapingServiceImpl", () => {
  let service: WebScrapingServiceImpl;

  beforeEach(() => {
    service = new WebScrapingServiceImpl();
  });

  describe("isValidUrl", () => {
    // Valid public URLs
    it("should accept valid public HTTPS URLs", () => {
      expect(service.isValidUrl("https://google.com")).toBe(true);
      expect(service.isValidUrl("https://www.example.com/path?query=1")).toBe(true);
    });

    it("should accept valid public HTTP URLs", () => {
      expect(service.isValidUrl("http://example.com")).toBe(true);
    });

    // Invalid protocols
    it("should reject non-HTTP/HTTPS protocols", () => {
      expect(service.isValidUrl("ftp://example.com")).toBe(false);
      expect(service.isValidUrl("file:///etc/passwd")).toBe(false);
      expect(service.isValidUrl("javascript:alert(1)")).toBe(false);
    });

    // Malformed URLs
    it("should reject malformed URLs", () => {
      expect(service.isValidUrl("not-a-url")).toBe(false);
      expect(service.isValidUrl("")).toBe(false);
    });

    // SSRF Vectors - currently these pass, but should fail after fix
    // I'll mark them as "should fail" so the test fails now, confirming vulnerability
    it("should reject localhost", () => {
      expect(service.isValidUrl("http://localhost")).toBe(false);
      expect(service.isValidUrl("http://localhost:3000")).toBe(false);
    });

    it("should reject loopback IP", () => {
      expect(service.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://127.0.0.1:8080")).toBe(false);
    });

    it("should reject IPv6 loopback", () => {
      expect(service.isValidUrl("http://[::1]")).toBe(false);
    });

    it("should reject private IPv4 ranges", () => {
      expect(service.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(service.isValidUrl("http://172.16.0.1")).toBe(false);
      expect(service.isValidUrl("http://192.168.1.1")).toBe(false);
    });

    it("should reject link-local addresses", () => {
      expect(service.isValidUrl("http://169.254.169.254")).toBe(false);
    });

    it("should reject any IP address format even if valid public IP (optional, strict mode)", () => {
        // For now we allow public IPs, but we must block private ones.
        // Let's test a public IP passes
        // expect(service.isValidUrl("http://8.8.8.8")).toBe(true);
    });
  });
});
