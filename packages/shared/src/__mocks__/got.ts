// Mock implementation of got for testing
const mockGot = jest.fn().mockImplementation(async (url: string, options?: any) => {
  // If there are beforeRequest hooks, run them
  if (options?.hooks?.beforeRequest) {
    for (const hook of options.hooks.beforeRequest) {
      // Create a mock options object that the hook can modify
      const hookOptions = {
        url: new URL(url),
        headers: { ...options.headers },
        https: { ...options.https }
      };
      await hook(hookOptions);
      // Update url to whatever the hook set it to (in reality got does more, but this is enough to trigger the exception in tests)
      url = hookOptions.url.toString();
    }
  }

  return {
    statusCode: 200,
    statusMessage: "OK",
    headers: {
      "content-type": "text/html",
    },
    body: `<html><head><title>Test Page</title></head><body><h1>Mock Content for ${url}</h1></body></html>`,
  };
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
