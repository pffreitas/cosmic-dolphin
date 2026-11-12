import {
  FirecrawlPageProvider,
  SupadataTranscriptProvider,
} from "../../services/extraction-providers";
import { withFetchDeadline } from "../../services/content-extraction";

describe("extraction provider contracts", () => {
  const originalFetch = global.fetch;
  let request: jest.Mock;
  beforeEach(() => {
    request = jest.fn();
    global.fetch = request as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("requests cleaned HTML with a bounded timeout and no provider caching", async () => {
    request.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          html: "<p>Article content</p>",
          metadata: {
            title: "Article",
            statusCode: 200,
            url: "https://example.com/final",
          },
        },
      }),
    });
    const result = await new FirecrawlPageProvider("test-key").extract(
      "https://example.com",
    );
    expect(result).toMatchObject({
      html: "<p>Article content</p>",
      title: "Article",
      finalUrl: "https://example.com/final",
    });
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(JSON.parse(options.body)).toMatchObject({
      url: "https://example.com",
      formats: ["html"],
      onlyMainContent: true,
      storeInCache: false,
      timeout: 40000,
    });
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not accept a provider's successful wrapper for a blocked target page", async () => {
    request.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { html: "<p>Forbidden</p>", metadata: { statusCode: 403 } },
      }),
    });
    await expect(
      new FirecrawlPageProvider("test-key").extract("https://example.com"),
    ).rejects.toMatchObject({ shouldRetry: true });
  });

  it.each([401, 402, 429, 503])(
    "classifies provider HTTP %s",
    async (status) => {
      request.mockResolvedValueOnce({ ok: false, status });
      await expect(
        new FirecrawlPageProvider("test-key").extract("https://example.com"),
      ).rejects.toMatchObject({ shouldRetry: status === 429 || status >= 500 });
    },
  );

  it("supports managed captions and automatic speech transcription without forcing English", async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: "Transcript text", lang: "pt" }),
    });
    for (const mode of ["native", "auto"]) {
      const result = await new SupadataTranscriptProvider(
        "test-key",
        mode,
      ).fetchTranscript("https://youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result).toMatchObject({
        status: "complete",
        text: "Transcript text",
        language: "pt",
      });
      const url = request.mock.calls.at(-1)![0] as URL;
      expect(url.searchParams.get("mode")).toBe(mode);
      expect(url.searchParams.has("lang")).toBe(false);
    }
  });

  it("handles async creation, polling, completion, and failure", async () => {
    request
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ jobId: "job-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "active" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "completed",
          content: [{ text: "Hello" }, { text: "world" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "failed" }),
      });
    const provider = new SupadataTranscriptProvider("test-key", "auto");
    expect(
      await provider.fetchTranscript("https://example.com/video"),
    ).toMatchObject({ status: "pending", jobId: "job-1" });
    expect(
      await provider.fetchTranscript("https://example.com/video", "job-1"),
    ).toMatchObject({ status: "pending", jobId: "job-1" });
    expect(
      await provider.fetchTranscript("https://example.com/video", "job-1"),
    ).toMatchObject({ status: "complete", text: "Hello world" });
    expect(String(request.mock.calls[1][0])).toBe(
      "https://api.supadata.ai/v1/transcript/job-1",
    );
    await expect(
      provider.fetchTranscript("https://example.com/video", "job-1"),
    ).rejects.toMatchObject({ code: "unavailable", shouldRetry: false });
  });

  it("aborts stalled requests and classifies timeouts as retryable", async () => {
    request.mockImplementation(
      (_url, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new Error("Aborted")),
          );
        }),
    );
    await expect(
      withFetchDeadline(10, (boundedFetch) =>
        boundedFetch("https://example.com"),
      ),
    ).rejects.toMatchObject({ shouldRetry: true });
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
