import * as net from 'net';
import * as dns from 'dns';

/**
 * Checks if an IP address is private or reserved.
 * Handles both IPv4 and IPv6.
 */
export function isPrivateIP(ip: string): boolean {
  if (!net.isIP(ip)) {
    return false;
  }

  // IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 127.0.0.0/8 - Loopback
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 - Private
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 - Private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 - Private
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 - Link-local
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 - Current network
    if (parts[0] === 0) return true;

    return false;
  }

  // IPv6
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();

    // ::1 Loopback
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // fe80::/10 Link-local
    if (normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb')) return true;

    // fc00::/7 Unique Local
    if (normalized.startsWith('fc') ||
        normalized.startsWith('fd')) return true;

    // ::ffff:127.0.0.1 IPv4 mapped loopback
    // This is a rough check. ::ffff:0:0/96 is IPv4 mapped.
    if (normalized.startsWith('::ffff:')) {
      const ipv4Part = normalized.replace('::ffff:', '');
      if (net.isIPv4(ipv4Part)) {
        return isPrivateIP(ipv4Part);
      }
    }

    return false;
  }

  return false;
}

/**
 * A wrapper around dns.lookup that validates the resolved IP address.
 * If the IP is private, it returns an error.
 */
export function safeLookup(
  hostname: string,
  options: dns.LookupOneOptions | ((err: NodeJS.ErrnoException | null, address: string, family: number) => void) | null | undefined,
  callback?: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
): void {
  let cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void;
  let opts: dns.LookupOneOptions | undefined;

  if (typeof options === 'function') {
    cb = options;
    opts = {};
  } else {
    cb = callback!;
    opts = (options as dns.LookupOneOptions) || {};
  }

  dns.lookup(hostname, opts, (err, address, family) => {
    if (err) {
      return cb(err, address as string, family as number);
    }

    // address can be string or object[] depending on options.all
    // But got uses LookupOneOptions mostly.
    // If address is an array, we should validate all of them?
    // dns.lookup only returns array if options.all is true.

    if (typeof address === 'string') {
        if (isPrivateIP(address)) {
            const error = new Error(`SSRF Protection: DNS lookup for ${hostname} resolved to private IP ${address}`) as NodeJS.ErrnoException;
            error.code = 'ENOTFOUND';
            return cb(error, '', 0);
        }
        return cb(null, address, family as number);
    }

    // If it's an array (which shouldn't happen with standard got usage but just in case)
    // We fail safe.
     if (Array.isArray(address)) {
        // We don't support validating arrays here yet for simplicity,
        // and got usually expects single address for connection unless configured otherwise.
        // But let's be safe.
        const error = new Error(`SSRF Protection: Unexpected address format`) as NodeJS.ErrnoException;
        error.code = 'ENOTFOUND';
        return cb(error, '', 0);
    }

    cb(null, address as any, family as number);
  });
}
