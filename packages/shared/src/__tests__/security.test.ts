import { isSafeIp, isSafeHostname } from "../security";

describe("Security Utils", () => {
  describe("isSafeIp", () => {
    it("should return true for public IPv4 addresses", () => {
      expect(isSafeIp("8.8.8.8")).toBe(true);
      expect(isSafeIp("1.1.1.1")).toBe(true);
      expect(isSafeIp("142.250.0.0")).toBe(true);
    });

    it("should return false for private IPv4 addresses", () => {
      expect(isSafeIp("127.0.0.1")).toBe(false);
      expect(isSafeIp("10.0.0.1")).toBe(false);
      expect(isSafeIp("192.168.1.1")).toBe(false);
      expect(isSafeIp("172.16.0.1")).toBe(false);
      expect(isSafeIp("172.31.255.255")).toBe(false);
      expect(isSafeIp("169.254.0.1")).toBe(false);
      expect(isSafeIp("0.0.0.0")).toBe(false);
    });

    it("should return true for public IPv6 addresses", () => {
      expect(isSafeIp("2001:4860:4860::8888")).toBe(true);
    });

    it("should return false for private IPv6 addresses", () => {
      expect(isSafeIp("::1")).toBe(false);
      expect(isSafeIp("::")).toBe(false);
      expect(isSafeIp("fc00::1")).toBe(false);
      expect(isSafeIp("fd00::1")).toBe(false);
      expect(isSafeIp("fe80::1")).toBe(false);
    });

    it("should return false for IPv4-mapped IPv6 addresses that are private", () => {
      expect(isSafeIp("::ffff:127.0.0.1")).toBe(false);
      expect(isSafeIp("::ffff:192.168.1.1")).toBe(false);
    });

    it("should return true for IPv4-mapped IPv6 addresses that are public", () => {
      expect(isSafeIp("::ffff:8.8.8.8")).toBe(true);
    });
  });
});
