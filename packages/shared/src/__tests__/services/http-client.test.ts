import { CosmicHttpClient } from "../../services/http-client";

describe("CosmicHttpClient SSRF Protection", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("blocks requests to localhost (IPv4)", async () => {
    await expect(client.fetch("http://127.0.0.1")).rejects.toThrow(/SSRF blocked/);
  });

  it("blocks requests to localhost (hostname)", async () => {
    await expect(client.fetch("http://localhost")).rejects.toThrow(/SSRF blocked/);
  });
});
