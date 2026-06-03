import { CosmicHttpClient } from "../../services/http-client";

describe("CosmicHttpClient SSRF Prevention", () => {
  it("should block requests to localhost via IPv4", async () => {
    const client = new CosmicHttpClient();
    await expect(client.fetch("http://127.0.0.1:3000")).rejects.toThrow(/SSRF Validation Failed/);
  });

  it("should block requests to localhost via DNS", async () => {
    const client = new CosmicHttpClient();
    await expect(client.fetch("http://localhost:3000")).rejects.toThrow(/SSRF Validation Failed/);
  });

  it("should block requests to cloud metadata service", async () => {
    const client = new CosmicHttpClient();
    await expect(client.fetch("http://169.254.169.254")).rejects.toThrow(/SSRF Validation Failed/);
  });

  it("should block requests to localhost via IPv6 literal", async () => {
    const client = new CosmicHttpClient();
    await expect(client.fetch("http://[::1]:3000")).rejects.toThrow(/SSRF Validation Failed/);
  });
});
