import dns from 'dns';
import net from 'net';

/**
 * Checks if an IP address belongs to a private or reserved range.
 * Supports IPv4 and IPv6 (including IPv4-mapped IPv6).
 */
export function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
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
  } else if (net.isIPv6(ip)) {
    // Loopback ::1
    if (ip === '::1') return true;
    // Unique Local Address fc00::/7 (fc00... to fdff...)
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
    // Link-local fe80::/10 (fe80... to febf...)
    if (ip.toLowerCase().startsWith('fe8') || ip.toLowerCase().startsWith('fe9') || ip.toLowerCase().startsWith('fea') || ip.toLowerCase().startsWith('feb')) return true;

    // IPv4 mapped addresses ::ffff:1.2.3.4
    if (ip.toLowerCase().startsWith('::ffff:')) {
       const ipv4 = ip.split(':').pop();
       if (ipv4 && net.isIPv4(ipv4)) {
         return isPrivateIP(ipv4);
       }
    }

    return false;
  }
  return false;
}

/**
 * A wrapper around dns.lookup that validates the resolved IP address.
 * Prevents SSRF by blocking access to private IP addresses.
 */
export function safeLookup(hostname: string, options: any, callback: any): void {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    dns.lookup(hostname, options, (err, address: string | dns.LookupAddress[], family) => {
        if (err) {
            return callback(err, address, family);
        }

        // Single address
        if (typeof address === 'string') {
             if (isPrivateIP(address)) {
                 return callback(new Error(`SSRF Prevention: Access to private IP ${address} denied`));
             }
        }
        // Multiple addresses (if all: true)
        else if (Array.isArray(address)) {
             for (const addr of address) {
                 if (isPrivateIP(addr.address)) {
                     return callback(new Error(`SSRF Prevention: Access to private IP ${addr.address} denied`));
                 }
             }
        }

        callback(null, address, family);
    });
}
