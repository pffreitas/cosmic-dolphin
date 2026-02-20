import { isPrivateIP, isSafeHostname, safeLookup } from '../security';
import * as dns from 'node:dns';

jest.mock('node:dns');

describe('Security Utilities', () => {
  describe('isPrivateIP', () => {
    it('should return true for private IPv4 addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should return false for public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false); // Outside 172.16.0.0/12
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });

    it('should return true for private IPv6 addresses', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
      expect(isPrivateIP('fe90::1')).toBe(true);
      expect(isPrivateIP('fea0::1')).toBe(true);
      expect(isPrivateIP('feb0::1')).toBe(true);
    });

    it('should return true for IPv4-mapped IPv6 addresses that are private', () => {
        expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });

    it('should return false for public IPv6 addresses', () => {
      expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
    });

    it('should return false for invalid IPs', () => {
      expect(isPrivateIP('not-an-ip')).toBe(false);
      expect(isPrivateIP('')).toBe(false);
    });
  });

  describe('isSafeHostname', () => {
    it('should return false for localhost', () => {
      expect(isSafeHostname('localhost')).toBe(false);
      expect(isSafeHostname('sub.localhost')).toBe(false);
    });

    it('should return false for local/internal domains', () => {
      expect(isSafeHostname('my-server.local')).toBe(false);
      expect(isSafeHostname('service.internal')).toBe(false);
    });

    it('should return false for private IP addresses passed as hostname', () => {
      expect(isSafeHostname('127.0.0.1')).toBe(false);
      expect(isSafeHostname('192.168.1.50')).toBe(false);
      expect(isSafeHostname('::1')).toBe(false);
      expect(isSafeHostname('[::1]')).toBe(false); // Bracketed IPv6
      expect(isSafeHostname('[fe80::1]')).toBe(false);
    });

    it('should return true for safe public domains', () => {
      expect(isSafeHostname('google.com')).toBe(true);
      expect(isSafeHostname('example.com')).toBe(true);
    });

    it('should return true for public IP addresses', () => {
        expect(isSafeHostname('8.8.8.8')).toBe(true);
    });
  });

  describe('safeLookup', () => {
    const mockDnsLookup = dns.lookup as unknown as jest.Mock;

    beforeEach(() => {
      mockDnsLookup.mockClear();
    });

    it('should allow public IPs', (done) => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, '8.8.8.8', 4);
      });

      safeLookup('google.com', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('8.8.8.8');
        done();
      });
    });

    it('should block private IPs', (done) => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, '127.0.0.1', 4);
      });

      safeLookup('localhost', {}, (err, address, family) => {
        expect(err).toBeTruthy();
        expect(err?.message).toContain('Access to private IP 127.0.0.1 is denied');
        done();
      });
    });

    it('should pass through errors from dns.lookup', (done) => {
        const expectedError = new Error('DNS Error');
        mockDnsLookup.mockImplementation((hostname, options, callback) => {
            callback(expectedError, undefined, undefined);
        });

        safeLookup('invalid-domain', {}, (err, address, family) => {
            expect(err).toBe(expectedError);
            done();
        });
    });
  });
});
