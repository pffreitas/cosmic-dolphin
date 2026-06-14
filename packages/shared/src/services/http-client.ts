const got = require("got").default || require("got");
import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

function isAllowedIp(ip: string): boolean {
  if (ip === "0.0.0.0") return false;
  if (ip === "::1") return false;

  if (ip.startsWith("127.")) return false;
  if (ip.startsWith("10.")) return false;
  if (ip.startsWith("192.168.")) return false;
  if (ip.startsWith("169.254.")) return false;

  for (let i = 16; i <= 31; i++) {
    if (ip.startsWith(`172.${i}.`)) return false;
  }

  // IPv6 checks
  const ipv6Normalized = ip.replace(/^::ffff:/, '').toLowerCase();

  // Checking if IPv4 mapped representation was stripped but matched above
  if (net.isIPv4(ipv6Normalized) && !isAllowedIp(ipv6Normalized)) {
    return false;
  }

  // IPv6 ANY
  if (ipv6Normalized === "::") return false;

  if (ipv6Normalized.startsWith("fc") || ipv6Normalized.startsWith("fd")) return false;
  if (
    ipv6Normalized.startsWith("fe8") ||
    ipv6Normalized.startsWith("fe9") ||
    ipv6Normalized.startsWith("fea") ||
    ipv6Normalized.startsWith("feb")
  ) return false;

  return true;
}

export interface HttpClient {
  /**
   * Fetch data from a URL
   * @param url The URL to fetch
   * @returns Promise that resolves to an HttpResponse
   */
  fetch(url: string): Promise<HttpResponse>;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: HttpHeaders;
  body: string;
  redirectUrl?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface HttpHeaders {
  get(name: string): string | null;
}

/**
 * Robust HTTP client implementation using Got with retry logic and proper error handling
 */
export class CosmicHttpClient implements HttpClient {
  private readonly requestTimeout = 30000; // 30 seconds for complex sites

  async fetch(url: string): Promise<HttpResponse> {
    try {
      const response = await got(url, {
        timeout: { request: this.requestTimeout },
        retry: {
          limit: 3,
          methods: ["GET"],
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
          calculateDelay: function ({ attemptCount }: any) {
            const baseDelay = 1000;
            const exponentialDelay = baseDelay * Math.pow(2, attemptCount - 1);
            const jitter = Math.random() * 1000;
            // backoffLimit is ignored when calculateDelay is provided, so cap explicitly
            return Math.min(exponentialDelay + jitter, 10000);
          },
          backoffLimit: 10000,
        },
        headers: {
          "User-Agent": this.getRandomUserAgent(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Cache-Control": "max-age=0",
          "sec-ch-ua":
            '"Chromium";v="122", "Not(A:Brand)";v="24", "Google Chrome";v="122"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
        },
        followRedirect: true,
        decompress: true,
        throwHttpErrors: true,
        hooks: {
          beforeRequest: [
            async (options: any) => {
              console.log(
                `🌐 Making request to ${options.url} (attempt ${options.retryCount || 1})`
              );

              const originalHostname = options.url.hostname;

              // Bypass DNS lookup for raw IPs since they are already resolved.
              let addressToUse = originalHostname;
              if (!net.isIP(originalHostname.replace(/^\[(.*)\]$/, '$1'))) {
                try {
                  const { address } = await lookupAsync(originalHostname);
                  addressToUse = address;
                } catch (err: any) {
                  throw new Error(`DNS lookup failed for ${originalHostname}: ${err.message}`);
                }
              } else {
                 addressToUse = originalHostname.replace(/^\[(.*)\]$/, '$1');
              }

              if (!isAllowedIp(addressToUse)) {
                throw new Error(`Access to internal/private IP ${addressToUse} is forbidden.`);
              }

              options.url.hostname = net.isIPv6(addressToUse) ? `[${addressToUse}]` : addressToUse;
              options.headers.host = originalHostname;

              if (options.url.protocol === 'https:' && !net.isIP(originalHostname.replace(/^\[(.*)\]$/, '$1'))) {
                  options.https = options.https || {};
                  options.https.servername = originalHostname;
              }
            },
          ],
          afterResponse: [
            (response: any) => {
              console.log(
                `✅ Response: ${response.statusCode} ${response.statusMessage}`
              );
              return response;
            },
          ],
          beforeRetry: [
            (error: any, retryCount: number) => {
              console.log(
                `🔄 Retry ${retryCount} for ${error.options?.url}: ${error.message}`
              );
            },
          ],
        },
      });

      const finalUrl = response.url || response.requestUrl;
      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        statusText: response.statusMessage || "",
        headers: {
          get: (name: string) => response.headers[name.toLowerCase()] || null,
        },
        body: response.body,
        redirectUrl: finalUrl !== url ? finalUrl : undefined,
        arrayBuffer: async () => Buffer.from(response.body).buffer,
      };
    } catch (error) {
      if (error instanceof (got as any).TimeoutError) {
        throw new Error("Request timeout: URL took too long to respond");
      }
      if (error instanceof (got as any).HTTPError) {
        const httpError = error as any;
        throw new Error(
          `HTTP ${httpError.response.statusCode}: ${httpError.response.statusMessage}`
        );
      }
      throw error;
    }
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
}
