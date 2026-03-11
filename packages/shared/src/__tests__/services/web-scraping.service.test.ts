import { WebScrapingServiceImpl } from '../../services/web-scraping.service';

describe('WebScrapingService', () => {
  let service: WebScrapingServiceImpl;

  beforeEach(() => {
    service = new WebScrapingServiceImpl();
  });

  describe('isValidUrl', () => {
    it('should return true for valid HTTP URLs', () => {
      expect(service.isValidUrl('http://example.com')).toBe(true);
    });

    it('should return true for valid HTTPS URLs', () => {
      expect(service.isValidUrl('https://example.com')).toBe(true);
    });

    it('should return false for non-HTTP/HTTPS protocols', () => {
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
      expect(service.isValidUrl('file:///etc/passwd')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(service.isValidUrl('not-a-url')).toBe(false);
    });

    // SSRF Tests - These should fail until the fix is implemented
    it('should return false for localhost', () => {
       expect(service.isValidUrl('http://localhost')).toBe(false);
       expect(service.isValidUrl('http://localhost:3000')).toBe(false);
    });

    it('should return false for 127.0.0.1', () => {
      expect(service.isValidUrl('http://127.0.0.1')).toBe(false);
      expect(service.isValidUrl('http://127.0.0.1:8080')).toBe(false);
    });

    it('should return false for private IPv4 addresses', () => {
      expect(service.isValidUrl('http://192.168.1.1')).toBe(false);
      expect(service.isValidUrl('http://10.0.0.1')).toBe(false);
      expect(service.isValidUrl('http://172.16.0.1')).toBe(false);
    });

    it('should return false for metadata service', () => {
      expect(service.isValidUrl('http://169.254.169.254')).toBe(false);
    });

     it('should return false for private IPv6 addresses', () => {
      expect(service.isValidUrl('http://[::1]')).toBe(false);
      expect(service.isValidUrl('http://[fc00::1]')).toBe(false);
    });

    it('should return false for 0.0.0.0', () => {
      expect(service.isValidUrl('http://0.0.0.0')).toBe(false);
    });

    it('should return false for IPv4-mapped IPv6 loopback', () => {
      expect(service.isValidUrl('http://[::ffff:127.0.0.1]')).toBe(false);
    });

    it('should return false for IPv4-mapped IPv6 private', () => {
      expect(service.isValidUrl('http://[::ffff:192.168.1.1]')).toBe(false);
    });
  });
});
