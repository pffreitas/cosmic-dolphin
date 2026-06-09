import { CosmicHttpClient } from "../../services/http-client";

// Mock dns module completely so it resolves private IP addresses to themselves for testing
jest.mock("dns/promises", () => ({
  lookup: jest.fn().mockImplementation(async (hostname: string) => {
    if (hostname === "invalid.domain.xyz") {
      throw new Error("ENOTFOUND");
    }
    // Simplistic mock: return hostname as the address since our tests pass IPs directly
    return { address: hostname };
  }),
}));

jest.mock("got", () => {
  const mockGotModule = jest.requireActual("../../__mocks__/got").default;
  const got = Object.assign(mockGotModule, {
    TimeoutError: class TimeoutError extends Error {},
    HTTPError: class HTTPError extends Error {}
  });
  return Object.assign(got, { default: got });
});

describe("CosmicHttpClient SSRF Mitigation", () => {
  let client: CosmicHttpClient;

  beforeEach(() => {
    client = new CosmicHttpClient();
    jest.clearAllMocks();
  });

  it("should block requests to localhost (127.0.0.1)", async () => {
    await expect(client.fetch("http://127.0.0.1")).rejects.toThrow(
      /SSRF Prevention: Access to internal IP/
    );
  });

  it("should block requests to 0.0.0.0", async () => {
    await expect(client.fetch("http://0.0.0.0")).rejects.toThrow(
      /SSRF Prevention: Access to internal IP/
    );
  });

  it("should block requests to private networks (10.0.0.1)", async () => {
    await expect(client.fetch("http://10.0.0.1")).rejects.toThrow(
      /SSRF Prevention: Access to internal IP/
    );
  });

  it("should block requests to 169.254.169.254 (Cloud metadata)", async () => {
    await expect(client.fetch("http://169.254.169.254")).rejects.toThrow(
      /SSRF Prevention: Access to internal IP/
    );
  });

  it("should fail closed if DNS resolution fails", async () => {
    await expect(client.fetch("http://invalid.domain.xyz")).rejects.toThrow(
      /SSRF Prevention: DNS resolution failed/
    );
  });
});
