import { isPrivateIP, safeLookup } from '../security';

// Mock dns module
jest.mock('dns', () => ({
  lookup: jest.fn(),
}));

const dns = require('dns');

describe('Security Utils', () => {
  describe('isPrivateIP', () => {
    it('should identify private IPv4 addresses', () => {
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should identify public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false); // Outside 172.16.0.0/12
      expect(isPrivateIP('192.169.1.1')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
    });

    it('should identify private IPv6 addresses', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should identify IPv4-mapped private IPv6 addresses', () => {
      expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
    });

    it('should identify public IPv6 addresses', () => {
      expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
    });
  });

  describe('safeLookup', () => {
    beforeEach(() => {
      (dns.lookup as jest.Mock).mockClear();
    });

    it('should allow public IPs', (done) => {
      const publicIP = '8.8.8.8';
      (dns.lookup as jest.Mock).mockImplementation((hostname: string, options: any, callback: any) => {
        callback(null, publicIP, 4);
      });

      safeLookup('google.com', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe(publicIP);
        done();
      });
    });

    it('should block private IPs', (done) => {
      const privateIP = '127.0.0.1';
      (dns.lookup as jest.Mock).mockImplementation((hostname: string, options: any, callback: any) => {
        callback(null, privateIP, 4);
      });

      safeLookup('localhost', {}, (err, address, family) => {
        expect(err).toBeDefined();
        expect(err?.message).toContain('SSRF Prevention');
        done();
      });
    });

    it('should block private IPs when returned as array', (done) => {
      const privateIP = '127.0.0.1';
      (dns.lookup as jest.Mock).mockImplementation((hostname: string, options: any, callback: any) => {
        // emulate all: true behavior
        callback(null, [{ address: privateIP, family: 4 }]);
      });

      // safeLookup signature for callback is (err, address, family) where address can be array
      safeLookup('localhost', { all: true } as any, (err, address, family) => {
        expect(err).toBeDefined();
        expect(err?.message).toContain('SSRF Prevention');
        done();
      });
    });
  });
});
