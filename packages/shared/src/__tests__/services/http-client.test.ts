import { CosmicHttpClient } from "../../services/http-client";
import { safeLookup } from "../../security";
const got = require("got");

// The mock is automatically applied via moduleNameMapper in jest.config.js
// but we need to type it as a jest.Mock to use jest matchers on it.
// The actual import will be the mock function from __mocks__/got.ts

describe("CosmicHttpClient Integration", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
    jest.clearAllMocks();
  });

  it("should configure got with safeLookup for DNS resolution", async () => {
    await client.fetch("http://example.com");

    // Handle both ESM and CJS mock imports
    const gotMock = got.default || got;

    expect(gotMock).toHaveBeenCalledWith(
      expect.stringContaining("http://example.com"),
      expect.objectContaining({
        dnsLookup: safeLookup,
        timeout: expect.anything(),
      })
    );
  });
});
