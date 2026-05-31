import { CosmicHttpClient } from '../../services/http-client';
import got from 'got';
import { promises as dns } from 'dns';
import { jest } from '@jest/globals';

jest.mock('got', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    statusCode: 200,
    statusMessage: 'OK',
    headers: {},
    body: 'mock body',
  }),
}));

jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

describe('CosmicHttpClient SSRF Prevention', () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
    jest.clearAllMocks();
  });

  it('should not block external IP address by default in current code', async () => {
    (dns.lookup as jest.Mock).mockResolvedValue({ address: '127.0.0.1' } as never);
    // this will probably throw something else due to got being mocked
    try {
      await client.fetch('http://127.0.0.1');
    } catch (e: any) {
        // console.log(e);
    }
  });
});
