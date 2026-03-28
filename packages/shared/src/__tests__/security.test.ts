import { isPrivateIP, safeLookup } from '../security';
import dns from 'dns';

jest.mock('dns');

describe('Security', () => {
  describe('isPrivateIP', () => {
    it('should return true for private IPv4 addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
    });

    it('should return false for public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
      expect(isPrivateIP('192.169.1.1')).toBe(false);
    });

    it('should return true for private IPv6 addresses', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should return true for IPv4-mapped IPv6 addresses that are private', () => {
        expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });

    it('should return false for public IPv6 addresses', () => {
      expect(isPrivateIP('2001:db8::1')).toBe(false);
    });
  });

  describe('safeLookup', () => {
    const mockLookup = dns.lookup as unknown as jest.Mock;

    beforeEach(() => {
        mockLookup.mockReset();
    });

    it('should call callback with error if IP is private', (done) => {
      mockLookup.mockImplementation((hostname: string, options: any, callback: any) => {
        callback(null, '127.0.0.1', 4);
      });

      safeLookup('localhost', {}, (err: Error, address: string) => {
        expect(err).toBeDefined();
        expect(err.message).toContain('SSRF Prevention');
        done();
      });
    });

    it('should call callback with address if IP is public', (done) => {
      mockLookup.mockImplementation((hostname: string, options: any, callback: any) => {
        callback(null, '8.8.8.8', 4);
      });

      safeLookup('google.com', {}, (err: Error, address: string) => {
        expect(err).toBeNull();
        expect(address).toBe('8.8.8.8');
        done();
      });
    });

    it('should handle dns lookup errors', (done) => {
        const error = new Error('DNS Error');
        mockLookup.mockImplementation((hostname: string, options: any, callback: any) => {
            callback(error);
        });

        safeLookup('invalid.domain', {}, (err: Error) => {
            expect(err).toBe(error);
            done();
        });
    });
  });
});
