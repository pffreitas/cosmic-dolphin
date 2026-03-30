import { YouTubeServiceImpl } from "../../services/youtube.service";
import { HttpClient } from "../../services/http-client";
import { YoutubeTranscript, YoutubeTranscriptNotAvailableLanguageError } from "youtube-transcript";

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

describe("YouTubeServiceImpl", () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let service: YouTubeServiceImpl;

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
  });

  describe("isYouTubeUrl", () => {
    it.each([
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", true],
      ["https://youtu.be/dQw4w9WgXcQ", true],
      ["https://youtube.com/shorts/dQw4w9WgXcQ", true],
      ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", true],
      ["https://www.youtube.com/embed/dQw4w9WgXcQ", true],
      ["https://www.youtube.com/live/dQw4w9WgXcQ", true],
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
    ])("extractVideoId(%s) === %s", (url, expected) => {
      expect(service.extractVideoId(url)).toBe(expected);
    });
  });

  describe("scrape", () => {
    const URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    it("should return scraped content with transcript when English transcript is available", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      const result = await service.scrape(URL);

      expect(result.title).toBe("Test Video Title");
      expect(result.content).toContain("Hello world this is a test");
      expect(result.content).toContain("YouTube Video: Test Video Title");
      expect(result.metadata?.openGraph?.description).toBe("Video by Test Channel");
      expect(result.metadata?.wordCount).toBeGreaterThan(0);
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenCalledWith("dQw4w9WgXcQ", { lang: "en" });
    });

    it("should fall back to default language when English transcript is not available", async () => {
      MockedYoutubeTranscript.fetchTranscript
        .mockRejectedValueOnce(new YoutubeTranscriptNotAvailableLanguageError("en", ["pt"], "dQw4w9WgXcQ"))
        .mockResolvedValueOnce([{ text: "Olá mundo", duration: 1000, offset: 0, lang: "pt" }]);

      const result = await service.scrape(URL);

      expect(result.content).toContain("Olá mundo");
      expect(result.metadata?.openGraph?.description).toBe("Video by Test Channel");
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenCalledTimes(2);
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenNthCalledWith(1, "dQw4w9WgXcQ", { lang: "en" });
      expect(MockedYoutubeTranscript.fetchTranscript).toHaveBeenNthCalledWith(2, "dQw4w9WgXcQ");
    });

    it("should show no transcript message when transcript is completely unavailable", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockRejectedValue(new Error("Transcripts disabled"));

      const result = await service.scrape(URL);

      expect(result.content).toContain("No transcript available for this video.");
      expect(result.metadata?.openGraph?.description).toContain("no transcript available");
      expect(result.metadata?.wordCount).toBe(0);
    });

    it("should show no transcript message when transcript segments are empty", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue([]);

      const result = await service.scrape(URL);

      expect(result.content).toContain("No transcript available for this video.");
      expect(result.metadata?.wordCount).toBe(0);
    });

    it("should throw when video ID cannot be extracted", async () => {
      await expect(service.scrape("https://www.youtube.com/watch")).rejects.toThrow(
        "Could not extract video ID from URL"
      );
    });

    it("should throw when oEmbed request fails", async () => {
      mockHttpClient.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: "",
        headers: new Headers() as any,
        arrayBuffer: async () => new ArrayBuffer(0),
      });
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      await expect(service.scrape(URL)).rejects.toThrow("Failed to fetch YouTube video metadata");
    });

    it("should return correct images with high-res thumbnail", async () => {
      MockedYoutubeTranscript.fetchTranscript.mockResolvedValue(MOCK_TRANSCRIPT_SEGMENTS);

      const result = await service.scrape(URL);

      expect(result.images).toEqual([
        { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg", alt: "Test Video Title" },
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
