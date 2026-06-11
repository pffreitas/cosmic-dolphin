import { CosmicHttpClient } from "../../services/http-client";

jest.mock("dns", () => ({
  promises: {
    lookup: jest.fn().mockImplementation(async (hostname) => {
      if (hostname === "localhost") return { address: "127.0.0.1" };
      if (hostname === "internal.example.com") return { address: "10.0.0.1" };
      return { address: "93.184.216.34" };
    }),
  },
}));

describe("CosmicHttpClient", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("should fetch external URLs", async () => {
    const response = await client.fetch("https://example.com");
    expect(response.ok).toBe(true);
  });

  it("should block direct internal IP addresses", async () => {
    await expect(client.fetch("http://127.0.0.1")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://10.0.0.1")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://169.254.169.254")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://0.0.0.0")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://172.16.0.1")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://172.31.255.255")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://[::1]")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://[fc00::1]")).rejects.toThrow("SSRF blocked");
  });

  it("should block domain names that resolve to internal IPs", async () => {
    await expect(client.fetch("http://localhost")).rejects.toThrow("SSRF blocked");
    await expect(client.fetch("http://internal.example.com")).rejects.toThrow("SSRF blocked");
  });
});
