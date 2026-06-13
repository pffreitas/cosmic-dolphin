// Mock implementation of got for testing
const mockGot = jest.fn().mockImplementation(async (url: string, options?: any) => {
  if (options?.hooks?.beforeRequest && Array.isArray(options.hooks.beforeRequest)) {
    // A rudimentary options object with a url object to support SSRF testing
    const hookOptions = {
      ...options,
      url: new URL(url),
      headers: options.headers || {},
      https: options.https || {}
    };
    for (const hook of options.hooks.beforeRequest) {
      await hook(hookOptions);
    }
  }

  return Promise.resolve({
    statusCode: 200,
    statusMessage: "OK",
    headers: {
      "content-type": "text/html",
    },
    body: `<html><head><title>Test Page</title></head><body><h1>Mock Content for ${url}</h1></body></html>`,
  });
});

// Mock the various error types that got uses
(mockGot as any).TimeoutError = class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
};

(mockGot as any).HTTPError = class HTTPError extends Error {
  response: any;
  constructor(response: any) {
    super(`Response code ${response.statusCode} (${response.statusMessage})`);
    this.name = "HTTPError";
    this.response = response;
  }
};

export default mockGot;
