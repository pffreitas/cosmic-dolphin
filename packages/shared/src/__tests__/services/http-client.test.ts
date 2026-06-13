import { CosmicHttpClient } from "../../services/http-client";

// Ensure we are testing with the actual got library mocked to throw our hook errors
jest.mock("got");

describe("CosmicHttpClient SSRF Protections", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
  });

  it("should block requests to 127.0.0.1", async () => {
    await expect(client.fetch("http://127.0.0.1/admin")).rejects.toThrow("SSRF attempt blocked");
  });

  it("should block requests to internal IPv4 networks", async () => {
    await expect(client.fetch("http://10.0.0.1/secret")).rejects.toThrow("SSRF attempt blocked");
    await expect(client.fetch("http://172.16.0.5/api")).rejects.toThrow("SSRF attempt blocked");
    await expect(client.fetch("http://192.168.1.1/config")).rejects.toThrow("SSRF attempt blocked");
    await expect(client.fetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow("SSRF attempt blocked");
  });

  it("should block requests to IPv6 loopback", async () => {
    await expect(client.fetch("http://[::1]/")).rejects.toThrow("SSRF attempt blocked");
  });

  it("should block requests to 0.0.0.0", async () => {
    await expect(client.fetch("http://0.0.0.0/")).rejects.toThrow("SSRF attempt blocked");
  });
});
