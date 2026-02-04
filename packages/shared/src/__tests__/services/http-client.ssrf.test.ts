import { CosmicHttpClient } from '../../services/http-client';
import { describe, expect, it, beforeAll, jest } from '@jest/globals';

// We need to require got to access the mock
let gotMock = require('got');
if (gotMock.default) {
    gotMock = gotMock.default;
}

describe('CosmicHttpClient SSRF Protection', () => {
  const client = new CosmicHttpClient();

  beforeAll(() => {
    // Override the mock implementation to simulate dnsLookup
    (gotMock as unknown as jest.Mock).mockImplementation(async (...args: any[]) => {
      const [url, options] = args;

      if (options?.dnsLookup) {
        const urlObj = new URL(url);
        // Remove brackets for IPv6 literal if present
        let hostname = urlObj.hostname;
        if (hostname.startsWith('[') && hostname.endsWith(']')) {
            hostname = hostname.slice(1, -1);
        }

        // We must promisify the callback-based dnsLookup
        await new Promise((resolve, reject) => {
          options.dnsLookup(hostname, {}, (err: any, address: any) => {
            if (err) return reject(err);
            resolve(address);
          });
        });
      }

      return {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "content-type": "text/html" },
        body: `<html><body>Safe Content for ${url}</body></html>`,
      };
    });
  });

  it('should block access to localhost', async () => {
    await expect(client.fetch('http://localhost')).rejects.toThrow(/SSRF Protection/);
  });

  it('should block access to 127.0.0.1', async () => {
    await expect(client.fetch('http://127.0.0.1')).rejects.toThrow(/SSRF Protection/);
  });

  it('should block access to 169.254.169.254', async () => {
    await expect(client.fetch('http://169.254.169.254')).rejects.toThrow(/SSRF Protection/);
  });

  it('should block access to ::1', async () => {
    await expect(client.fetch('http://[::1]')).rejects.toThrow(/SSRF Protection/);
  });

  it('should allow access to public domains', async () => {
     // example.com resolves to public IP, so dnsLookup should succeed, and our mock returns success.
     await expect(client.fetch('http://example.com')).resolves.toMatchObject({
         ok: true,
         body: expect.stringContaining('Safe Content')
     });
  }, 30000);
});
