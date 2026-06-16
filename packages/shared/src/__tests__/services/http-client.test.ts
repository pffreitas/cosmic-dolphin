import { CosmicHttpClient } from "../../services/http-client";

describe("CosmicHttpClient SSRF Protection", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("should block requests to 127.0.0.1", async () => {
    await expect(client.fetch("http://127.0.0.1")).rejects.toThrow(/Security Error/);
  });

  it("should block requests to localhost", async () => {
    await expect(client.fetch("http://localhost:8080")).rejects.toThrow(/Security Error/);
  });

  it("should block requests to private IPv4 space (10.x.x.x)", async () => {
    await expect(client.fetch("http://10.0.0.5")).rejects.toThrow(/Security Error/);
  });

  it("should block requests to private IPv4 space (192.168.x.x)", async () => {
    await expect(client.fetch("http://192.168.1.1")).rejects.toThrow(/Security Error/);
  });

  it("should block requests to link-local address (169.254.169.254)", async () => {
    await expect(client.fetch("http://169.254.169.254")).rejects.toThrow(/Security Error/);
  });

  it("should block requests to IPv6 loopback (::1)", async () => {
    await expect(client.fetch("http://[::1]")).rejects.toThrow(/Security Error/);
  });

  it("should block requests to IPv4-mapped IPv6 loopback", async () => {
    await expect(client.fetch("http://[::ffff:127.0.0.1]")).rejects.toThrow(/Security Error/);
  });

  it("should allow requests to public domains", async () => {
    const response = await client.fetch("https://example.com");
    expect(response.ok).toBe(true);
  });
});
