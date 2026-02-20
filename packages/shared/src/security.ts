import * as net from 'node:net';
import * as dns from 'node:dns';

/**
 * Checks if an IP address is private or reserved.
 * @param ip The IP address to check
 * @returns boolean true if the IP is private/reserved
 */
export function isPrivateIP(ip: string): boolean {
  // Normalize by removing brackets if present
  const cleanIp = ip.replace(/^\[|\]$/g, '');

  if (!net.isIP(cleanIp)) return false;

  // IPv4 Private Ranges
  // 10.0.0.0/8
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  // 192.168.0.0/16
  // 127.0.0.0/8 (Loopback)
  // 169.254.0.0/16 (Link-Local)
  // 0.0.0.0/8 (This host on this network)
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }

  // IPv6 Private Ranges
  // ::1/128 (Loopback)
  // fc00::/7 (Unique Local Address)
  // fe80::/10 (Link-Local Unicast)
  if (net.isIPv6(cleanIp)) {
    const normalized = cleanIp.toLowerCase();

    // Loopback
    if (normalized === '::1') return true;
    if (normalized === '::') return true; // Unspecified address, usually safe to block

    // Unique Local Address (fc00::/7) -> starts with fc or fd
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // Link-Local (fe80::/10) -> starts with fe8, fe9, fea, feb
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;

    // IPv4 Mapped Address (::ffff:0:0/96)
    // Check if it ends with an IPv4 address
    if (normalized.includes('.')) {
      const parts = normalized.split(':');
      const lastPart = parts[parts.length - 1];
      if (net.isIPv4(lastPart)) {
        return isPrivateIP(lastPart);
      }
    }

    return false;
  }

  return false;
}

/**
 * Checks if a hostname is safe (i.e., not localhost or private IP string).
 * Note: This is a synchronous check and does not resolve DNS.
 * Use safeLookup for DNS-based verification.
 * @param hostname The hostname to check
 * @returns boolean true if the hostname appears safe
 */
export function isSafeHostname(hostname: string): boolean {
  if (!hostname) return false;

  const lower = hostname.toLowerCase();

  // Block localhost
  if (lower === 'localhost') return false;
  if (lower.endsWith('.localhost')) return false;

  // Block specific known local domains
  if (lower.endsWith('.local')) return false;
  if (lower.endsWith('.internal')) return false;

  // If it's an IP address, check if it's private
  // Handle bracketed IPv6 (e.g. [::1]) which URL.hostname returns
  const cleanHostname = hostname.replace(/^\[|\]$/g, '');

  if (net.isIP(cleanHostname)) {
    return !isPrivateIP(cleanHostname);
  }

  return true;
}

/**
 * Custom DNS lookup function for 'got' that validates the resolved IP address.
 * Blocks access to private and reserved IP ranges to prevent SSRF.
 */
export function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void
): void {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      return callback(err, address as any, family);
    }

    // Handle single address
    if (typeof address === 'string') {
      if (isPrivateIP(address)) {
        const error = new Error(`SSRF Prevention: Access to private IP ${address} is denied`);
        (error as any).code = 'ENOTFOUND';
        return callback(error as NodeJS.ErrnoException, address, family);
      }
    }
    // Handle array of addresses (if all: true was passed)
    else if (Array.isArray(address)) {
      for (const addr of address) {
        if (isPrivateIP(addr.address)) {
          const error = new Error(`SSRF Prevention: Access to private IP ${addr.address} is denied`);
          (error as any).code = 'ENOTFOUND';
          return callback(error as NodeJS.ErrnoException, address as any, family);
        }
      }
    }

    callback(null, address as any, family);
  });
}
