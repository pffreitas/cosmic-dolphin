import dns from 'dns';
import net from 'net';

/**
 * Checks if an IP address is in a private or reserved range.
 * Protected ranges:
 * - 0.0.0.0/8 (Current network)
 * - 10.0.0.0/8 (Private)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local)
 * - 172.16.0.0/12 (Private)
 * - 192.168.0.0/16 (Private)
 * - ::1 (IPv6 Loopback)
 * - fc00::/7 (IPv6 Unique Local)
 * - fe80::/10 (IPv6 Link-local)
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return false;
  }

  // IPv4 Private Ranges
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 169.254.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
  }

  // IPv6 Private Ranges
  if (net.isIPv6(ip)) {
    // IPv6 Loopback
    if (ip === '::1') return true;
    // IPv6 Unique Local
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
    // IPv6 Link-local
    if (ip.toLowerCase().startsWith('fe80:')) return true;

    // IPv4-mapped IPv6 addresses (::ffff:127.0.0.1)
    if (ip.toLowerCase().startsWith('::ffff:')) {
       const ipv4 = ip.substring(7);
       // Validate the extracted IPv4 part
       if (net.isIPv4(ipv4)) {
         return isPrivateIp(ipv4);
       }
    }

    return false;
  }

  return false;
}

/**
 * A wrapper around dns.lookup that blocks private IP addresses.
 * Can be used as a custom lookup function for 'got' or 'http.request'.
 */
export const safeDnsLookup = ((hostname: string, options: any, callback: any) => {
  // Normalize arguments
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  const lookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => {
    if (err) {
      return callback(err, address, family);
    }

    if (typeof address === 'string') {
        if (isPrivateIp(address)) {
            const error = new Error(`SSRF Protection: Access to private IP ${address} is denied`);
            (error as any).code = 'ENOTFOUND';
            return callback(error, address, family);
        }
    } else if (Array.isArray(address)) {
        for (const addr of address) {
             if (isPrivateIp(addr.address)) {
                 const error = new Error(`SSRF Protection: Access to private IP ${addr.address} is denied`);
                 (error as any).code = 'ENOTFOUND';
                 return callback(error, address, family); // Return the array or undefined? callback expects addresses
             }
        }
    }

    callback(null, address, family);
  };

  return dns.lookup(hostname, options, lookupCallback);
}) as typeof dns.lookup;
