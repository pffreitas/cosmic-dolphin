import * as dns from 'dns';

/**
 * Checks if an IP address is private or reserved.
 * Handles both IPv4 and IPv6.
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4
  if (ip.includes('.')) {
    // Check for IPv4-mapped IPv6
    if (ip.toLowerCase().startsWith('::ffff:')) {
      return isPrivateIP(ip.substring(7));
    }

    const parts = ip.split('.');
    if (parts.length === 4) {
      const octets = parts.map(p => parseInt(p, 10));
      if (octets.some(isNaN)) return false; // Invalid IP, let DNS handle or fail elsewhere

      // 127.0.0.0/8 (Loopback)
      if (octets[0] === 127) return true;

      // 10.0.0.0/8 (Private)
      if (octets[0] === 10) return true;

      // 172.16.0.0/12 (Private)
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;

      // 192.168.0.0/16 (Private)
      if (octets[0] === 192 && octets[1] === 168) return true;

      // 169.254.0.0/16 (Link-local)
      if (octets[0] === 169 && octets[1] === 254) return true;

      // 0.0.0.0/8 (Current network)
      if (octets[0] === 0) return true;

      return false;
    }
  }

  // IPv6
  const lowerIP = ip.toLowerCase();

  // Loopback
  if (lowerIP === '::1' || lowerIP === '0:0:0:0:0:0:0:1') return true;

  // Unique Local Address (fc00::/7) -> fc00... to fdff...
  if (lowerIP.startsWith('fc') || lowerIP.startsWith('fd')) return true;

  // Link-local (fe80::/10) -> fe80... to febf...
  // fe8, fe9, fea, feb
  if (lowerIP.startsWith('fe8') || lowerIP.startsWith('fe9') || lowerIP.startsWith('fea') || lowerIP.startsWith('feb')) return true;

  return false;
}

/**
 * A safe wrapper around dns.lookup that blocks private IP addresses to prevent SSRF.
 */
export function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void
): void {
  // If options is a function (legacy node style), shift args
  // But got passes (hostname, options, callback)

  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      callback(err, address as any, family);
      return;
    }

    // Handle single address (string) or array of addresses (LookupAddress[])
    if (typeof address === 'string') {
      if (isPrivateIP(address)) {
        const error = new Error(`SSRF Prevention: Access to private IP ${address} is denied`);
        (error as any).code = 'ENOTFOUND';
        callback(error as NodeJS.ErrnoException, address, family);
        return;
      }
    } else if (Array.isArray(address)) {
       // Check all addresses
       for (const addr of address) {
         if (isPrivateIP(addr.address)) {
           const error = new Error(`SSRF Prevention: Access to private IP ${addr.address} is denied`);
           (error as any).code = 'ENOTFOUND';
           // If we block one, we block the whole request for safety
           callback(error as NodeJS.ErrnoException, address, family);
           return;
         }
       }
    }

    callback(null, address as any, family);
  });
}
