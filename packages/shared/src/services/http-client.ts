const got = require("got").default || require("got");
import * as net from "net";
import * as dns from "dns/promises";

/**
 * Checks if an IP address belongs to a private, loopback, or non-routable range.
 */
function isPrivateIP(ip: string): boolean {
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
    if (!ip.includes(".")) {
      const parts = ip.split(":");
      let v4 = "";
      if (parts.length === 2) {
        const p1 = parseInt(parts[0], 16);
        const p2 = parseInt(parts[1], 16);
        v4 = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
      } else if (parts.length === 1) {
        const p = parseInt(parts[0], 16);
        v4 = `${(p >> 24) & 0xff}.${(p >> 16) & 0xff}.${(p >> 8) & 0xff}.${p & 0xff}`;
      }
      if (v4) ip = v4;
    }
  }
  if (ip === "::" || ip === "0.0.0.0") return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    ip = ip.replace(/^\[(.*)\]$/, "$1");
    if (ip === "::1") return true;
    if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true;
    if (ip.toLowerCase().startsWith("fe8") || ip.toLowerCase().startsWith("fe9") || ip.toLowerCase().startsWith("fea") || ip.toLowerCase().startsWith("feb")) return true;
    return false;
  }

  return false;
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
              let hostname = options.url.hostname;
              const cleanHostname = hostname.replace(/^\[(.*)\]$/, "$1");

              let ip = cleanHostname;
              if (!net.isIP(cleanHostname)) {
                try {
                  const lookup = await dns.lookup(cleanHostname);
                  ip = lookup.address;
                } catch (err) {
                  throw new Error("DNS lookup failed: SSRF protection blocked the request.");
                }
              }

              if (isPrivateIP(ip)) {
                throw new Error("Security Error: Blocked access to private or internal IP address.");
              }

              // Override URL to connect to the resolved IP directly to prevent DNS rebinding TOCTOU
              if (net.isIPv6(ip)) {
                options.url.hostname = `[${ip}]`;
              } else {
                options.url.hostname = ip;
              }
              options.headers.host = hostname;

              if (options.url.protocol === "https:" && !net.isIP(cleanHostname)) {
                options.https = options.https || {};
                options.https.servername = hostname;
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
