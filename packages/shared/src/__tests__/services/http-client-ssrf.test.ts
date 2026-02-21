import { CosmicHttpClient } from "../../services/http-client";
import { safeLookup } from "../../security";
// @ts-ignore
import got from "got";

describe("CosmicHttpClient SSRF Protection", () => {
  const client = new CosmicHttpClient();

  beforeEach(() => {
    // Clear mock calls
    if ((got as any).mockClear) {
      (got as any).mockClear();
    }
  });

  it("should configure got with safeLookup for DNS resolution", async () => {
    await client.fetch("http://example.com");

    expect(got).toHaveBeenCalledWith(
      "http://example.com",
      expect.objectContaining({
        dnsLookup: safeLookup,
      })
    );
  });
});
