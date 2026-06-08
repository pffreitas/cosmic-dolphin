import { CosmicHttpClient } from "../../services/http-client";

describe("CosmicHttpClient", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("should block requests to private IPv4 addresses", async () => {
    await expect(client.fetch("http://127.0.0.1:3000")).rejects.toThrow(/SSRF blocked/);
    await expect(client.fetch("http://10.0.0.1")).rejects.toThrow(/SSRF blocked/);
    await expect(client.fetch("http://192.168.1.1")).rejects.toThrow(/SSRF blocked/);
  });

  it("should block requests to private IPv6 addresses", async () => {
    await expect(client.fetch("http://[::1]")).rejects.toThrow(/SSRF blocked/);
  });

  it("should block requests to localhost via DNS lookup", async () => {
    await expect(client.fetch("http://localhost:3000")).rejects.toThrow(/SSRF blocked/);
  });
});
