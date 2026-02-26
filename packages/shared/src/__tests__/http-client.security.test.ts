import { CosmicHttpClient } from '../services/http-client';
import { safeLookup } from '../security';

// Use require to bypass import issues with got mock
const got = require('got');

describe('CosmicHttpClient Security', () => {
  it('should use safeLookup for DNS resolution', async () => {
    const client = new CosmicHttpClient();
    await client.fetch('http://example.com');

    // The mock in __mocks__/got.ts exports default
    const gotMock = got.default || got;

    expect(gotMock).toHaveBeenCalledWith(
      expect.stringContaining('example.com'),
      expect.objectContaining({
        dnsLookup: safeLookup
      })
    );
  });
});
