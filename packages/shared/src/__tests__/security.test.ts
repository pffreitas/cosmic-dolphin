import { isPrivateIP, safeLookup } from "../security";
import * as dns from "dns";

jest.mock("dns");

describe("Security Utils", () => {
  describe("isPrivateIP", () => {
    it("should identify private IPv4 addresses", () => {
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("172.16.0.1")).toBe(true);
      expect(isPrivateIP("172.31.255.255")).toBe(true);
      expect(isPrivateIP("192.168.1.1")).toBe(true);
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("169.254.1.1")).toBe(true);
      expect(isPrivateIP("0.0.0.0")).toBe(true);
    });

    it("should identify public IPv4 addresses", () => {
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
      expect(isPrivateIP("172.15.0.1")).toBe(false);
      expect(isPrivateIP("172.32.0.1")).toBe(false);
    });

    it("should identify private IPv6 addresses", () => {
      expect(isPrivateIP("::1")).toBe(true);
      expect(isPrivateIP("fc00::1")).toBe(true);
      expect(isPrivateIP("fe80::1")).toBe(true);
      expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIP("[::1]")).toBe(true);
    });

    it("should identify public IPv6 addresses", () => {
      expect(isPrivateIP("2001:4860:4860::8888")).toBe(false);
      expect(isPrivateIP("2606:4700:4700::1111")).toBe(false);
    });
  });

  describe("safeLookup", () => {
    it("should allow public IPs", (done) => {
      (dns.lookup as unknown as jest.Mock).mockImplementation(
        (hostname, options, callback) => {
          callback(null, "8.8.8.8", 4);
        }
      );

      safeLookup("google.com", {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe("8.8.8.8");
        expect(family).toBe(4);
        done();
      });
    });

    it("should block private IPs", (done) => {
      (dns.lookup as unknown as jest.Mock).mockImplementation(
        (hostname, options, callback) => {
          callback(null, "127.0.0.1", 4);
        }
      );

      safeLookup("localhost", {}, (err, address, family) => {
        expect(err).toBeDefined();
        expect(err!.message).toContain("resolves to a private IP");
        done();
      });
    });

    it("should block private IPv6 IPs", (done) => {
      (dns.lookup as unknown as jest.Mock).mockImplementation(
        (hostname, options, callback) => {
          callback(null, "::1", 6);
        }
      );

      safeLookup("localhost", {}, (err, address, family) => {
        expect(err).toBeDefined();
        expect(err!.message).toContain("resolves to a private IP");
        done();
      });
    });
  });
});
