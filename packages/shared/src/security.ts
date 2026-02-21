import { isIP } from "net";
import * as dns from "dns";

// Check if IP is in a private range
export function isSafeIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false; // Invalid IP

  if (version === 4) {
    // IPv4 checks
    const parts = ip.split(".").map((part) => parseInt(part, 10));
    if (parts.length !== 4) return false;

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return false;

    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return false;

    // 100.64.0.0/10 (Shared Address Space)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;

    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return false;

    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return false;

    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return false;

    // 192.0.2.0/24 (TEST-NET-1)
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return false;

    // 192.88.99.0/24 (6to4 Relay Anycast)
    if (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) return false;

    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return false;

    // 198.18.0.0/15 (Network Benchmark)
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return false;

    // 198.51.100.0/24 (TEST-NET-2)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return false;

    // 203.0.113.0/24 (TEST-NET-3)
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return false;

    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return false;

    // 240.0.0.0/4 (Reserved)
    if (parts[0] >= 240) return false;

    return true;
  } else if (version === 6) {
    // IPv6 checks

    // Handle IPv4-mapped IPv6 addresses (::ffff:1.2.3.4)
    if (ip.toLowerCase().startsWith("::ffff:")) {
        const ipv4 = ip.substring(7);
        return isSafeIp(ipv4);
    }

    // Strip brackets if present (though isIP usually expects no brackets)
    const normalizedIp = ip.replace(/^\[|\]$/g, '');

    // ::1 (Loopback)
    if (normalizedIp === "::1" || normalizedIp === "0:0:0:0:0:0:0:1") return false;

    // :: (Unspecified)
    if (normalizedIp === "::" || normalizedIp === "0:0:0:0:0:0:0:0") return false;

    // Check for Unique Local (fc00::/7) -> fc or fd
    // We need to expand it to be sure, but checking start is a good heuristic if uncompressed
    // If compressed, it's harder. But usually resolved IPs from dns.lookup are expanded or at least standard.
    // Actually dns.lookup returns standard string representation.

    // fc00::/7
    // This includes fc00... and fd00...
    if (/^[fF][cCdD]/.test(normalizedIp)) return false;

    // fe80::/10 (Link-local) -> fe8, fe9, fea, feb
    if (/^[fF][eE][89aAbB]/.test(normalizedIp)) return false;

    return true;
  }
  return false;
}

export function safeLookup(hostname: string, options: any, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void): void {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      return callback(err, address as any, family);
    }

    const addresses = Array.isArray(address) ? address : [{ address: address as string, family: family as number }];

    for (const addr of addresses) {
      if (!isSafeIp(addr.address)) {
        const error = new Error(`Blocked DNS lookup for ${hostname}: resolved to private IP ${addr.address}`);
        (error as any).code = 'ENOTFOUND'; // Treat as not found/connection error
        return callback(error as any, address as any, family);
      }
    }

    return callback(null, address as any, family);
  });
}

// Helper to validate a hostname before any request (optional, but good for early rejection)
export function isSafeHostname(hostname: string): boolean {
  // Try to parse as IP first
  if (isIP(hostname)) {
    return isSafeIp(hostname);
  }
  return true; // If it's a domain name, we rely on safeLookup
}
