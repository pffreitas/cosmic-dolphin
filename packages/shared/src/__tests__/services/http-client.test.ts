import {
  CosmicHttpClient,
  calculateHttpRetryDelay,
} from "../../services/http-client";
const gotModule = require("got");
const got = (gotModule.default || gotModule) as jest.Mock;

describe("HTTP extraction transport", () => {
  it("preserves terminal retry decisions and server backoff", () => {
    expect(
      calculateHttpRetryDelay({ attemptCount: 100, computedValue: 0 }),
    ).toBe(0);
    expect(
      calculateHttpRetryDelay({ attemptCount: 1, computedValue: 20000 }),
    ).toBe(20000);
  });

  it("retains the response status for extraction fallback decisions", async () => {
    (got as unknown as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), {
        name: "HTTPError",
        response: { statusCode: 403, statusMessage: "Forbidden" },
      }),
    );
    await expect(
      new CosmicHttpClient().fetch("https://example.com"),
    ).rejects.toMatchObject({ status: 403, name: "HttpRequestError" });
  });

  it("allows caption requests to disable nested retries and use a shorter timeout", async () => {
    (got as unknown as jest.Mock).mockResolvedValueOnce({
      statusCode: 200,
      statusMessage: "OK",
      headers: {},
      body: "caption text",
      url: "https://example.com/captions",
    });
    await new CosmicHttpClient().fetch("https://example.com/captions", {
      timeoutMs: 8000,
      retryLimit: 0,
    });
    expect(got).toHaveBeenLastCalledWith(
      "https://example.com/captions",
      expect.objectContaining({
        timeout: { request: 8000 },
        retry: expect.objectContaining({ limit: 0 }),
      }),
    );
  });
});
