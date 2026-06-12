import { CosmicHttpClient } from "../../services/http-client";

jest.mock("got", () => {
  const mockGot = jest.fn().mockImplementation((url, options) => {
    let parsedUrl = url;
    if (typeof url === 'string') {
      parsedUrl = new URL(url);
    }

    // Default headers if missing
    if (!options) options = {};
    if (!options.headers) options.headers = {};
    if (!options.url) options.url = parsedUrl;

    if (options && options.hooks && options.hooks.beforeRequest) {
      let currentOptions = options;
      // Note: we're calling all async hooks manually
      return Promise.all(options.hooks.beforeRequest.map((hook: any) => hook(currentOptions)))
        .then(() => Promise.resolve({
          statusCode: 200,
          statusMessage: "OK",
          headers: { "content-type": "text/html" },
          body: "mock body",
        }));
    }
    return Promise.resolve({
      statusCode: 200,
      statusMessage: "OK",
      headers: { "content-type": "text/html" },
      body: "mock body",
    });
  });
  (mockGot as any).TimeoutError = class TimeoutError extends Error {};
  (mockGot as any).HTTPError = class HTTPError extends Error {
    response: any;
    constructor(response: any) {
      super();
      this.response = response;
    }
  };
  return { default: mockGot };
});

jest.mock("dns", () => {
  return {
    resolve4: jest.fn((hostname, callback) => {
      if (hostname === "internal.example.com") {
        callback(null, ["192.168.1.1"]);
      } else if (hostname === "public.example.com") {
        callback(null, ["93.184.216.34"]);
      } else if (hostname === "localhost") {
        callback(null, ["127.0.0.1"]);
      } else {
        callback(new Error("Not found"));
      }
    }),
    resolve6: jest.fn((hostname, callback) => callback(new Error("Not found"))),
  };
});

describe("CosmicHttpClient SSRF Protection", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("blocks requests to internal IP addresses directly", async () => {
    await expect(client.fetch("http://127.0.0.1")).rejects.toThrow(/Security Error/);
    await expect(client.fetch("http://169.254.169.254")).rejects.toThrow(/Security Error/);
    await expect(client.fetch("http://10.0.0.1")).rejects.toThrow(/Security Error/);
    await expect(client.fetch("http://[::1]")).rejects.toThrow(/Security Error/);
  });

  it("blocks requests to hostnames that resolve to internal IPs", async () => {
    await expect(client.fetch("http://localhost")).rejects.toThrow(/Security Error/);
    await expect(client.fetch("http://internal.example.com")).rejects.toThrow(/Security Error/);
  });

  it("allows requests to public hostnames and IP addresses", async () => {
    const publicDomainResult = await client.fetch("http://public.example.com");
    expect(publicDomainResult.ok).toBe(true);

    const publicIpResult = await client.fetch("http://8.8.8.8");
    expect(publicIpResult.ok).toBe(true);
  });
});
