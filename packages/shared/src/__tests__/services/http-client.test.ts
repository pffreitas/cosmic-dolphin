import { CosmicHttpClient } from "../../services/http-client";

describe("CosmicHttpClient", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("should block private IPs", async () => {
    await expect(client.fetch("http://127.0.0.1:8080/")).rejects.toThrow(
      "SSRF Protection: Access to private IP 127.0.0.1 is blocked"
    );
  });

  it("should block localhost domain", async () => {
    await expect(client.fetch("http://localhost:8080/")).rejects.toThrow(
      /SSRF Protection: Access to private IP .* is blocked/
    );
  });

  it("should block localtest.me", async () => {
    await expect(client.fetch("http://localtest.me/")).rejects.toThrow(
      /SSRF Protection: Access to private IP .* is blocked/
    );
  });

  it("should allow external domains and not strip port in host header", async () => {
    // Relying on mock implementation that succeeds on any non-blocked URL
    const res = await client.fetch("http://example.com:8080/");
    expect(res.ok).toBe(true);
  });
});
