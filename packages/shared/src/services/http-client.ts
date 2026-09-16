const gotModule = require("got");
const got = gotModule.default || gotModule;

function errorName(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name)
    : undefined;
}

function errorResponse(error: unknown):
  | { statusCode?: number; statusMessage?: string }
  | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  return (error as { response?: { statusCode?: number; statusMessage?: string } })
    .response;
}

export function calculateHttpRetryDelay({
  attemptCount,
  computedValue,
}: {
  attemptCount: number;
  computedValue: number;
}): number {
  // Got uses zero to signal that the error/status is not retryable or that
  // `retry.limit` has been exhausted. A custom calculateDelay must preserve
  // that decision; replacing zero with a positive delay retries forever.
  if (computedValue === 0) return 0;

  const baseDelay = 1000;
  const exponentialDelay = baseDelay * Math.pow(2, attemptCount - 1);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 10000);
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
  private readonly requestTimeout = 15000; // bounded even for unreachable hosts

  async fetch(url: string): Promise<HttpResponse> {
    try {
      const response = await got(url, {
        timeout: { request: this.requestTimeout },
        retry: {
          limit: 2,
          methods: ["GET"],
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
          calculateDelay: calculateHttpRetryDelay,
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
      // Got 14 exposes error classes on the module namespace, not necessarily
      // on its default request function. Shape checks also work across CJS/ESM
      // boundaries and avoid instanceof undefined on Bun.
      if (errorName(error) === "TimeoutError") {
        throw new Error("Request timeout: URL took too long to respond");
      }
      const response = errorResponse(error);
      if (errorName(error) === "HTTPError" && response) {
        throw new Error(
          `HTTP ${response.statusCode}: ${response.statusMessage || "Request denied"}`
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
