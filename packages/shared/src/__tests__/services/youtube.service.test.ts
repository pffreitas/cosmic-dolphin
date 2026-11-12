import { YouTubeServiceImpl } from "../../services/youtube.service";
import { HttpClient } from "../../services/http-client";
import { YoutubeTranscript, YoutubeTranscriptNotAvailableLanguageError } from "youtube-transcript";
import { BrowserExtractionProvider, TranscriptProvider } from "../../services/extraction-providers";
import { ContentExtractionError } from "../../services/content-extraction";

jest.mock("youtube-transcript");

const MockedYoutubeTranscript = YoutubeTranscript as jest.Mocked<typeof YoutubeTranscript>;

const MOCK_OEMBED = {
  title: "Test Video Title",
  author_name: "Test Channel",
  author_url: "https://www.youtube.com/channel/UC123",
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  thumbnail_width: 480,
  thumbnail_height: 360,
};

const MOCK_TRANSCRIPT_SEGMENTS = [
  { text: "Hello world", duration: 1000, offset: 0, lang: "en" },
  { text: "this is a test", duration: 1000, offset: 1000, lang: "en" },
];

const MOCK_INNERTUBE_RESPONSE = {
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        {
          baseUrl: "https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en",
          languageCode: "en",
        },
      ],
    },
  },
};

const MOCK_CAPTION_XML = `
<timedtext>
  <p t="0" d="1000">Hello from InnerTube</p>
  <p t="1000" d="1000">this is fallback</p>
</timedtext>
`;

describe("YouTubeServiceImpl", () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockFetch: jest.Mock;
  let service: YouTubeServiceImpl;
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpClient = { fetch: jest.fn() } as any;
    service = new YouTubeServiceImpl(mockHttpClient);

    mockHttpClient.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body: JSON.stringify(MOCK_OEMBED),
      headers: new Headers({ "content-type": "application/json" }) as any,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    // Default: global fetch is not called (library handles it)
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  describe("isYouTubeUrl", () => {
    it.each([
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", true],
      ["https://youtu.be/dQw4w9WgXcQ", true],
      ["https://youtube.com/shorts/dQw4w9WgXcQ", true],
      ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", true],
      ["https://www.youtube.com/embed/dQw4w9WgXcQ", true],
      ["https://www.youtube.com/live/dQw4w9WgXcQ", true],
      ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", true],
      ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", true],
      ["https://example.com", false],
      ["https://notyoutube.com/watch?v=abc", false],
      ["not-a-url", false],
    ])("isYouTubeUrl(%s) === %s", (url, expected) => {
      expect(service.isYouTubeUrl(url)).toBe(expected);
    });
  });

  describe("extractVideoId", () => {
    it.each([
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
      ["https://example.com/watch?v=abc", null],
      ["https://notyoutube.com/watch?v=dQw4w9WgXcQ", null],
      ["https://example.com/?url=https://youtube.com/watch?v=dQw4w9WgXcQ", null],
      ["https://youtube.com/watch?v=dQw4w9WgXcQextra", null],
    ])("extractVideoId(%s) === %s", (url, expected) => {
      expect(service.extractVideoId(url)).toBe(expected);
    });
  });

  describe("scrape", () => {
    const URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    it("fetches only metadata for a URL-card preview, without starting transcription", async () => {
      const provider = { fetchTranscript: jest.fn() };
      service = new YouTubeServiceImpl(mockHttpClient, provider);
      const result = await service.scrape(URL, { metadataOnly: true });
      expect(result.title).toBe(MOCK_OEMBED.title);
      expect(provider.fetchTranscript).not.toHaveBeenCalled();
      expect(MockedYoutubeTranscript.fetchTranscript).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("falls back to the original language when the English track is empty", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ text: "Olá mundo", duration: 1000, offset: 0, lang: "pt" }]);
      const result = await service.scrape(URL);
      expect(result.content).toContain("Olá mundo");
      expect(result.metadata.extraction).toMatchObject({ status: "complete", language: "pt" });
    });

    it("tries another caption track when the preferred track is blocked or empty", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [
        { baseUrl: "https://www.youtube.com/api/timedtext?lang=en", languageCode: "en" },
        { baseUrl: "https://www.youtube.com/api/timedtext?lang=pt", languageCode: "pt" },
      ] } } }) });
      mockHttpClient.fetch.mockImplementation(async (url) => ({
        ok: true, status: 200, statusText: "OK", headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0),
        body: url.includes("lang=en") ? "" : url.includes("lang=pt")
          ? '<transcript><text dur="2" start="0">Olá &amp; bem-vindo</text></transcript>'
          : JSON.stringify(MOCK_OEMBED),
      }));
      const result = await service.scrape(URL);
      expect(result.content).toContain("Olá & bem-vindo");
      expect(result.metadata.extraction?.language).toBe("pt");
    });

    it("reads JSON3 captions and flexible srv3 attribute order", async () => {
      for (const body of [
        JSON.stringify({ events: [{ segs: [{ utf8: "Hello " }, { utf8: "world" }] }] }),
        '<timedtext><p d="1000" t="0"><s>Hello </s><s>world</s></p></timedtext>',
      ]) {
        MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => MOCK_INNERTUBE_RESPONSE });
        mockHttpClient.fetch.mockImplementation(async (url) => ({
          ok: true, status: 200, statusText: "OK", headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0),
          body: url.includes("timedtext") ? body : JSON.stringify(MOCK_OEMBED),
        }));
        expect((await service.scrape(URL)).content).toContain("Hello world");
      }
    });

    it("recovers browser captions and metadata before managed transcription", async () => {
      const browser = { extractYouTube: jest.fn().mockResolvedValue({ title: "Recovered video", author: "Recovered channel", channelUrl: "https://www.youtube.com/channel/recovered", captions: [
        { body: '<html>Blocked English caption track</html>', language: "en" },
        { body: '<transcript><text start="0">Olá browser captions</text></transcript>', language: "pt" },
      ] }) } as unknown as BrowserExtractionProvider;
      const managed = { fetchTranscript: jest.fn() };
      service = new YouTubeServiceImpl(mockHttpClient, managed, browser);
      mockHttpClient.fetch.mockRejectedValue(new Error("oEmbed unavailable"));
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
      mockFetch.mockResolvedValue({ ok: false, status: 403 });
      const result = await service.scrape(URL);
      expect(result.content).toContain("Olá browser captions");
      expect(result.title).toBe("Recovered video");
      expect(result.metadata.extraction).toMatchObject({ status: "complete", provider: "lightpanda", language: "pt" });
      expect(browser.extractYouTube).toHaveBeenCalledTimes(1);
      expect(managed.fetchTranscript).not.toHaveBeenCalled();
    });

    it("falls through empty browser captions to managed transcription", async () => {
      const browser = { extractYouTube: jest.fn().mockResolvedValue({ captions: [] }) } as unknown as BrowserExtractionProvider;
      const managed = { fetchTranscript: jest.fn().mockResolvedValue({ status: "complete", text: "Managed speech", provider: "supadata" }) };
      service = new YouTubeServiceImpl(mockHttpClient, managed, browser);
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
      mockFetch.mockResolvedValue({ ok: false, status: 403 });
      expect((await service.scrape(URL)).content).toContain("Managed speech");
      expect(browser.extractYouTube).toHaveBeenCalledTimes(1);
    });

    it("never opens a browser for previews, native captions, or persisted jobs", async () => {
      const browser = { extractYouTube: jest.fn() } as unknown as BrowserExtractionProvider;
      const managed = { fetchTranscript: jest.fn().mockResolvedValue({ status: "pending", jobId: "job-1", provider: "supadata" }) };
      service = new YouTubeServiceImpl(mockHttpClient, managed, browser);
      await service.scrape(URL, { metadataOnly: true });
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);
      await service.scrape(URL);
      await service.scrape(URL, { transcriptJobId: "job-1" });
      expect(browser.extractYouTube).not.toHaveBeenCalled();
    });

    it("uses the managed provider only after native methods fail", async () => {
      const provider: jest.Mocked<TranscriptProvider> = { fetchTranscript: jest.fn().mockResolvedValue({ status: "complete", text: "Recovered speech transcript", provider: "supadata", language: "es" }) };
      service = new YouTubeServiceImpl(mockHttpClient, provider);
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      const result = await service.scrape(URL);
      expect(result.content).toContain("Recovered speech transcript");
      expect(result.metadata.extraction).toMatchObject({ status: "complete", provider: "supadata", language: "es" });
      expect(provider.fetchTranscript).toHaveBeenCalledWith(URL);
    });

    it("does not spend a managed request when native captions work", async () => {
      const provider = { fetchTranscript: jest.fn() };
      service = new YouTubeServiceImpl(mockHttpClient, provider);
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);
      await service.scrape(URL);
      expect(provider.fetchTranscript).not.toHaveBeenCalled();
    });

    it("persists pending transcription jobs and resumes them without another submission", async () => {
      const provider: jest.Mocked<TranscriptProvider> = { fetchTranscript: jest.fn().mockResolvedValue({ status: "pending", jobId: "job-1", provider: "supadata" }) };
      service = new YouTubeServiceImpl(mockHttpClient, provider);
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      const pending = await service.scrape(URL);
      expect(pending.content).toBe("");
      expect(pending.metadata.extraction).toMatchObject({ status: "pending", jobId: "job-1", retryable: true });
      provider.fetchTranscript.mockResolvedValueOnce({ status: "complete", text: "Finished transcript", provider: "supadata" });
      MockedYoutubeTranscript.fetchTranscript.mockClear();
      const recovered = await service.scrape(URL, { transcriptJobId: "job-1" });
      expect(provider.fetchTranscript).toHaveBeenLastCalledWith(URL, "job-1");
      expect(MockedYoutubeTranscript.fetchTranscript).not.toHaveBeenCalled();
      expect(recovered.content).toContain("Finished transcript");
      expect(recovered.metadata.extraction?.jobId).toBeUndefined();
    });

    it("retains a pending job after a transient error, but clears a failed job for manual retry", async () => {
      const provider: jest.Mocked<TranscriptProvider> = { fetchTranscript: jest.fn().mockRejectedValue(new ContentExtractionError("Rate limited", "provider", true)) };
      service = new YouTubeServiceImpl(mockHttpClient, provider);
      const transient = await service.scrape(URL, { transcriptJobId: "job-1" });
      expect(transient.metadata.extraction).toMatchObject({ jobId: "job-1", retryable: true });
      provider.fetchTranscript.mockRejectedValueOnce(new ContentExtractionError("Job failed", "unavailable", false));
      const failed = await service.scrape(URL, { transcriptJobId: "job-1" });
      expect(failed.metadata.extraction?.jobId).toBeUndefined();
      expect(failed.metadata.extraction?.retryable).toBe(false);
    });

    it("ignores caption URLs outside YouTube", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Blocked"));
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [
        { baseUrl: "https://youtube.com.evil.example/transcript", languageCode: "en" },
      ] } } }) });
      const result = await service.scrape(URL);
      expect(result.metadata.extraction?.status).toBe("unavailable");
      expect(mockHttpClient.fetch).toHaveBeenCalledTimes(1);
    });

    it("should return scraped content with transcript when English transcript is available", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      const result = await service.scrape(URL);

      expect(result.title).toBe("Test Video Title");
      expect(result.content).toContain("Hello world this is a test");
      expect(result.content).toContain("YouTube Video: Test Video Title");
      expect(result.metadata?.openGraph?.description).toBe("Video by Test Channel");
      expect(result.metadata?.wordCount).toBeGreaterThan(0);
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith("dQw4w9WgXcQ", { lang: "en", fetch: expect.any(Function) });
    });

    it("should fall back to default language when English transcript is not available", async () => {
      MockedYoutubeTranscript.fetchTranscript
        .mockRejectedValueOnce(new YoutubeTranscriptNotAvailableLanguageError("en", ["pt"], "dQw4w9WgXcQ"))
        .mockResolvedValueOnce([{ text: "Olá mundo", duration: 1000, offset: 0, lang: "pt" }]);

      const result = await service.scrape(URL);

      expect(result.content).toContain("Olá mundo");
      expect(result.metadata?.openGraph?.description).toBe("Video by Test Channel");
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenCalledTimes(2);
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenNthCalledWith(1, "dQw4w9WgXcQ", { lang: "en", fetch: expect.any(Function) });
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenNthCalledWith(2, "dQw4w9WgXcQ", { fetch: expect.any(Function) });
    });

    it("should try InnerTube fallback when library throws a non-language error", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("YouTube blocked the request"));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_INNERTUBE_RESPONSE,
      });
      mockHttpClient.fetch.mockImplementation(async (url: string) => {
        if (url.includes("timedtext")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            body: MOCK_CAPTION_XML,
            headers: new Headers() as any,
            arrayBuffer: async () => new ArrayBuffer(0),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: JSON.stringify(MOCK_OEMBED),
          headers: new Headers({ "content-type": "application/json" }) as any,
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      });

      const result = await service.scrape(URL);

      expect(result.content).toContain("Hello from InnerTube");
      expect(result.content).toContain("this is fallback");
      expect(result.metadata?.openGraph?.description).toBe("Video by Test Channel");
    });

    it("should try InnerTube fallback when library returns empty segments", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue([]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_INNERTUBE_RESPONSE,
      });
      mockHttpClient.fetch.mockImplementation(async (url: string) => {
        if (url.includes("timedtext")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            body: MOCK_CAPTION_XML,
            headers: new Headers() as any,
            arrayBuffer: async () => new ArrayBuffer(0),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          body: JSON.stringify(MOCK_OEMBED),
          headers: new Headers({ "content-type": "application/json" }) as any,
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      });

      const result = await service.scrape(URL);

      expect(result.content).toContain("Hello from InnerTube");
    });

    it("should record an incomplete extraction when both library and InnerTube fallback fail", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Transcripts disabled"));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      const result = await service.scrape(URL);

      expect(result.content).toBe("");
      expect(result.metadata.extraction).toMatchObject({ status: "unavailable", retryable: true });
      expect(result.metadata?.openGraph?.description).toContain("could not be retrieved");
      expect(result.metadata?.wordCount).toBe(0);
    });

    it("should record an incomplete extraction when InnerTube returns no caption tracks", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Transcripts disabled"));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [] } } }),
      });

      const result = await service.scrape(URL);

      expect(result.content).toBe("");
      expect(result.metadata.extraction).toMatchObject({ status: "unavailable", retryable: true });
    });

    it("should record an incomplete extraction when language fallback also fails", async () => {
      MockedYoutubeTranscript.fetchTranscript
        .mockRejectedValueOnce(new YoutubeTranscriptNotAvailableLanguageError("en", ["pt"], "dQw4w9WgXcQ"))
        .mockRejectedValueOnce(new Error("Network error"));
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await service.scrape(URL);

      expect(result.content).toBe("");
      expect(result.metadata.extraction).toMatchObject({ status: "unavailable", retryable: true });
    });

    it("should throw when video ID cannot be extracted", async () => {
      await expect(service.scrape("https://www.youtube.com/watch")).rejects.toThrow(
        "Could not extract video ID from URL"
      );
    });

    it("should preserve a transcript when oEmbed request fails", async () => {
      mockHttpClient.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: "",
        headers: new Headers() as any,
        arrayBuffer: async () => new ArrayBuffer(0),
      });
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      const result = await service.scrape(URL);
      expect(result.content).toContain("Hello world");
      expect(result.metadata.extraction?.status).toBe("complete");
    });

    it("should use the known oEmbed thumbnail instead of guessing a potentially missing image", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      const result = await service.scrape(URL);

      expect(result.images).toEqual([
        { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", alt: "Test Video Title" },
      ]);
    });

    it("should return channel link", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      const result = await service.scrape(URL);

      expect(result.links).toEqual([
        { url: "https://www.youtube.com/channel/UC123", text: "Test Channel" },
      ]);
    });
  });
});
