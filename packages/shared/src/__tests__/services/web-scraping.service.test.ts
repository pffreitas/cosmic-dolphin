import { WebScrapingServiceImpl } from '../../services/web-scraping.service';
import { HttpClient } from '../../services/http-client';

describe('WebScrapingService', () => {
  let service: WebScrapingServiceImpl;
  let mockHttpClient: jest.Mocked<HttpClient>;

  beforeEach(() => {
    mockHttpClient = {
      fetch: jest.fn(),
    } as any;
    service = new WebScrapingServiceImpl(mockHttpClient);
  });

  describe('isValidUrl', () => {
    it('should return true for valid HTTP/HTTPS URLs', () => {
      expect(service.isValidUrl('http://example.com')).toBe(true);
      expect(service.isValidUrl('https://google.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(service.isValidUrl('not-a-url')).toBe(false);
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
    });

    it('should return false for localhost', () => {
      expect(service.isValidUrl('http://localhost')).toBe(false);
      expect(service.isValidUrl('http://localhost:3000')).toBe(false);
    });

    it('should return false for private IPs', () => {
      expect(service.isValidUrl('http://127.0.0.1')).toBe(false);
      expect(service.isValidUrl('http://192.168.1.1')).toBe(false);
      expect(service.isValidUrl('http://10.0.0.1')).toBe(false);
    });

    it('should return false for bracketed private IPs', () => {
      expect(service.isValidUrl('http://[::1]')).toBe(false);
      expect(service.isValidUrl('http://[fe80::1]')).toBe(false);
    });
  });
});
