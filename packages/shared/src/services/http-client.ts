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
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface HttpHeaders {
  get(name: string): string | null;
}

/**
 * Default HTTP client implementation using the fetch API
 */
export class FetchHttpClient implements HttpClient {
  async fetch(url: string): Promise<HttpResponse> {
    const response = await fetch(url);

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: {
        get: (name: string) => response.headers.get(name),
      },
      arrayBuffer: () => response.arrayBuffer(),
    };
  }
}
