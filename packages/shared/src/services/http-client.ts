const got = require("got").default || require("got");
import { lookup } from "node:dns/promises";

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
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      if (hostname === "localhost" || hostname.includes("[") || hostname.includes("]")) {
        if (hostname === "localhost" || hostname === "[::1]" || hostname === "[::]") {
          throw new Error("SSRF prevention: Internal hostnames are not allowed");
        }
      }

      let resolvedIp = "";

      try {
        const records = await lookup(hostname, { all: true });
        for (const record of records) {
          if (record.family === 4) {
            const parts = record.address.split('.').map(Number);
            const octet1 = parts[0];
            const octet2 = parts[1];
            if (
              octet1 === 127 || octet1 === 10 || octet1 === 0 ||
              (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
              (octet1 === 192 && octet2 === 168) ||
              (octet1 === 169 && octet2 === 254)
            ) {
              throw new Error("SSRF prevention: Internal IP addresses are not allowed");
            }
            if (!resolvedIp) resolvedIp = record.address;
          } else if (record.family === 6) {
            const addr = record.address.toLowerCase();
            if (addr === '::1' || addr === '::' || addr.startsWith('fc') || addr.startsWith('fd') || addr.startsWith('fe8') || addr.startsWith('fe9') || addr.startsWith('fea') || addr.startsWith('feb')) {
              throw new Error("SSRF prevention: Internal IPv6 addresses are not allowed");
            }
            if (!resolvedIp) resolvedIp = `[${record.address}]`;
          }
        }
      } catch (dnsError: any) {
        if (dnsError.message.includes("SSRF prevention")) throw dnsError;
        // If DNS fails (e.g. bracketed IP), throw SSRF error to prevent bypasses
        throw new Error("SSRF prevention: DNS resolution failed or invalid hostname");
      }

      // Reconstruct URL with the resolved IP to prevent DNS rebinding (TOCTOU)
      urlObj.hostname = resolvedIp;
      // Also update the 'Host' header to the original hostname so the server routes correctly
      const targetUrl = urlObj.toString();

      const response = await got(targetUrl, {
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
          Host: hostname,
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
            (options: any) => {
              console.log(
                `🌐 Making request to ${options.url} (attempt ${options.retryCount || 1})`
              );
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
