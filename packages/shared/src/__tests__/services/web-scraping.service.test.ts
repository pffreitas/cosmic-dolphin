
import { WebScrapingServiceImpl } from '../../services/web-scraping.service';

describe('WebScrapingService', () => {
  let service: WebScrapingServiceImpl;

  beforeEach(() => {
    service = new WebScrapingServiceImpl();
  });

  describe('isValidUrl', () => {
    it('should validate standard URLs', () => {
      expect(service.isValidUrl('https://example.com')).toBe(true);
      expect(service.isValidUrl('http://google.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(service.isValidUrl('not-a-url')).toBe(false);
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should reject localhost and private IP addresses', () => {
      // These are the failing tests that confirm the vulnerability
      expect(service.isValidUrl('http://localhost')).toBe(false);
      expect(service.isValidUrl('http://127.0.0.1')).toBe(false);
      expect(service.isValidUrl('http://0.0.0.0')).toBe(false);
      expect(service.isValidUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(service.isValidUrl('http://192.168.1.1')).toBe(false);
      expect(service.isValidUrl('http://10.0.0.1')).toBe(false);
      expect(service.isValidUrl('http://172.16.0.1')).toBe(false);
    });
  });
});
