// Mock implementation of got for testing
const mockGot = jest.fn().mockImplementation(async (url: string, options?: any) => {
  // Execute hooks if provided
  if (options?.hooks?.beforeRequest) {
    for (const hook of options.hooks.beforeRequest) {
      // The original library mutates URL by reference
      const urlObj = new URL(url);
      const fakeOptions = {
        url: urlObj,
        headers: { ...options?.headers }
      };
      await hook(fakeOptions);
      // Update back URL just in case
      url = fakeOptions.url.toString();
    }
  }

  return Promise.resolve({
    url: url,
    requestUrl: url,
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
