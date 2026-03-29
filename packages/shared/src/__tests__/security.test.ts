import { isPrivateIP, safeLookup } from '../security';
import * as dns from 'dns';

jest.mock('dns');

describe('Security Utils', () => {
  describe('isPrivateIP', () => {
    it('should return true for IPv4 private addresses', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('169.254.0.1')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should return false for public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
      expect(isPrivateIP('11.0.0.1')).toBe(false);
    });

    it('should return true for IPv6 private addresses', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
      expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
    });

    it('should return false for public IPv6 addresses', () => {
      expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
    });

    it('should return false for invalid IPs', () => {
      expect(isPrivateIP('not-an-ip')).toBe(false);
    });
  });

  describe('safeLookup', () => {
    // We need to type cast dns.lookup to a jest Mock
    const mockLookup = dns.lookup as unknown as jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should succeed for public IP', (done) => {
      mockLookup.mockImplementation((hostname: any, options: any, callback: any) => {
        // safeLookup might pass options or callback as 2nd arg
        const cb = typeof options === 'function' ? options : callback;
        cb(null, '8.8.8.8', 4);
      });

      safeLookup('google.com', {}, (err, address) => {
        expect(err).toBeNull();
        expect(address).toBe('8.8.8.8');
        done();
      });
    });

    it('should fail for private IP', (done) => {
      mockLookup.mockImplementation((hostname: any, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        cb(null, '127.0.0.1', 4);
      });

      safeLookup('localhost', {}, (err, address) => {
        expect(err).toBeDefined();
        expect(err?.message).toContain('private IP');
        expect((err as any).code).toBe('ENOTFOUND');
        done();
      });
    });

    it('should handle DNS errors', (done) => {
      mockLookup.mockImplementation((hostname: any, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        const error = new Error('DNS Error');
        cb(error, undefined, undefined);
      });

      safeLookup('invalid.com', {}, (err, address) => {
        expect(err).toBeDefined();
        expect(err?.message).toBe('DNS Error');
        done();
      });
    });

    it('should handle optional options argument', (done) => {
       mockLookup.mockImplementation((hostname: any, options: any, callback: any) => {
        // Here options will be passed as {} by safeLookup internally
        const cb = typeof options === 'function' ? options : callback;
        cb(null, '8.8.8.8', 4);
      });

      safeLookup('google.com', undefined, (err, address) => {
        expect(err).toBeNull();
        expect(address).toBe('8.8.8.8');
        done();
      });
    });
  });
});
