const got = require("got").default || require("got");
const dns = require("dns").promises;
const net = require("net");

function isPrivateIP(ip: string): boolean {
  if (!ip) return false;

  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (ip === '::') return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0
    );
  } else if (net.isIPv6(ip)) {
    const normalizedIP = ip.toLowerCase();
    return (
      normalizedIP === '::1' ||
      normalizedIP.startsWith('fc00:') ||
      normalizedIP.startsWith('fd00:') ||
      normalizedIP.startsWith('fe80:')
    );
  }
  return false;
}

async function main() {
  let attemptCount = 0;
  try {
    const res = await got("https://example.com:443", {
      context: {},
      retry: {
        limit: 1,
        calculateDelay: () => 100
      },
      hooks: {
        beforeRequest: [
          async (options: any) => {
            attemptCount++;

            if (!options.context) {
              options.context = {};
            }

            let rawHostname = options.url.hostname;
            if (options.context.originalHostname) {
              rawHostname = options.context.originalHostname;
            } else {
              if (rawHostname.startsWith('[') && rawHostname.endsWith(']')) {
                rawHostname = rawHostname.slice(1, -1);
              }
              options.context.originalHostname = rawHostname;
              options.context.originalHost = options.url.host; // includes port
              options.context.isOriginalIp = net.isIP(rawHostname) !== 0;
            }

            const isIp = options.context.isOriginalIp;
            let ip = rawHostname;

            if (!isIp) {
              try {
                const resolved = await dns.lookup(rawHostname);
                ip = resolved.address;
              } catch (e: any) {
                throw new Error(`DNS lookup failed: ${e.message}`);
              }
            }

            if (isPrivateIP(ip)) {
              throw new Error(`SSRF Protection: Access to private IP ${ip} is blocked`);
            }

            if (net.isIPv6(ip)) {
              options.url.hostname = `[${ip}]`;
            } else {
              options.url.hostname = ip;
            }

            options.headers.host = options.context.originalHost;

            if (options.url.protocol === 'https:' && !isIp) {
              options.https = options.https || {};
              options.https.servername = options.context.originalHostname;
            }

            if (attemptCount === 1) {
              // Force failure
              throw new Error("Force fail");
            }
          }
        ],
        beforeRetry: [
          (error: any) => {
             console.log('retrying...', error.message);
          }
        ]
      }
    });
    console.log(res.statusCode);
  } catch (e: any) {
    console.log("final", e.message);
  }
}
main();
