import * as dns from "dns";
import * as net from "net";

/**
 * Checks if an IP address is private or internal.
 *
 * Supports both IPv4 and IPv6.
 *
 * @param ip The IP address to check
 * @returns true if the IP is private, false otherwise
 */
export function isPrivateIP(ip: string): boolean {
  // Remove brackets if present (e.g., [::1])
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    // Loopback
    if (ip === "::1") return true;
    // Unspecified
    if (ip === "::") return true;

    // Normalize to lowercase for easier checking
    const lowerIp = ip.toLowerCase();

    // Unique Local Addresses (fc00::/7) -> fc or fd
    if (lowerIp.startsWith("fc") || lowerIp.startsWith("fd")) return true;

    // Link-local addresses (fe80::/10) -> fe80 to febf
    if (/^fe[89ab][0-9a-f]/.test(lowerIp)) return true;

    // Site-local addresses (fec0::/10) -> fec0 to feff (Deprecated but should be blocked)
    if (/^fe[cdef][0-9a-f]/.test(lowerIp)) return true;

    // IPv4 Mapped IPv6 ::ffff:127.0.0.1
    if (lowerIp.startsWith("::ffff:")) {
      const ipv4Part = ip.substring(7);
      // It's possible for ipv4Part to be like 127.0.0.1 or other formats, net.isIPv4 handles standard dot-decimal
      if (net.isIPv4(ipv4Part)) {
        return isPrivateIP(ipv4Part);
      }
    }

    return false;
  }

  // Not a valid IP address
  return false;
}

/**
 * Validates if a hostname is safe to connect to (not resolving to a private IP).
 *
 * This function performs a DNS lookup and checks the resolved IP addresses against private ranges.
 * If any of the resolved IPs are private, it returns false.
 */
export async function isSafeHostname(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });

    for (const addr of addresses) {
      if (isPrivateIP(addr.address)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    // If DNS lookup fails, treat as unsafe or just let the caller handle it.
    // However, if the hostname doesn't resolve, it's technically "safe" in the sense that you can't connect to it,
    // but returning false is safer.
    return false;
  }
}

/**
 * A safe DNS lookup function to be used with `got` or other HTTP clients.
 *
 * It wraps `dns.lookup` and validates the resolved IP addresses against private ranges.
 * If a private IP is resolved, it returns an error, preventing the connection.
 */
export function safeLookup(
  hostname: string,
  options: any,
  callback?: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number
  ) => void
): void {
  let cb = callback;
  let opts = options;

  // Handle optional options argument
  if (typeof options === "function") {
    cb = options;
    opts = {};
  }

  if (!cb) {
    throw new Error("Callback is required");
  }

  dns.lookup(hostname, opts, (err, address, family) => {
    if (err) {
      return cb!(err, address as any, family);
    }

    const addresses = Array.isArray(address)
      ? address
      : [{ address, family }];

    for (const addr of addresses) {
      if (isPrivateIP(addr.address)) {
        const error = new Error(
          `DNS lookup failed: ${hostname} resolves to a private IP ${addr.address}`
        );
        (error as any).code = "ENOTFOUND"; // Simulate DNS failure
        return cb!(error, null as any, 0);
      }
    }

    // If safe, proceed with the original result
    return cb!(null, address as any, family);
  });
}
