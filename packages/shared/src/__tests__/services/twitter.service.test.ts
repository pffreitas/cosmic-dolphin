import { TwitterServiceImpl, TwitterScrapingError } from "../../services/twitter.service";
import { HttpClient } from "../../services/http-client";

const makeResponse = (body: object, ok = true) => ({
  body: JSON.stringify(body),
  status: ok ? 200 : 500,
  ok,
  statusText: ok ? "OK" : "Internal Server Error",
  headers: new Headers() as any,
  arrayBuffer: async () => new ArrayBuffer(0),
});

describe("TwitterService", () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let twitterService: TwitterServiceImpl;

  beforeEach(() => {
    mockHttpClient = {
      fetch: jest.fn(),
      post: jest.fn(),
      get: jest.fn(),
    } as any;
    twitterService = new TwitterServiceImpl(mockHttpClient);
  });

  describe("isTwitterUrl", () => {
    it("should return true for valid twitter and x.com URLs", () => {
      expect(twitterService.isTwitterUrl("https://twitter.com/user/status/123")).toBe(true);
      expect(twitterService.isTwitterUrl("https://x.com/user/status/123")).toBe(true);
      expect(twitterService.isTwitterUrl("https://www.twitter.com/user/status/123")).toBe(true);
      expect(twitterService.isTwitterUrl("https://www.x.com/user/status/123")).toBe(true);
      expect(twitterService.isTwitterUrl("https://google.com")).toBe(false);
      expect(twitterService.isTwitterUrl("not-a-url")).toBe(false);
    });
  });

  describe("scrape", () => {
    it("should build structured content from vxtwitter response", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(makeResponse({
        text: "Hello world!",
        user_name: "John Doe",
        user_screen_name: "johndoe",
        date: "2023-10-01T12:00:00Z",
        likes: 100,
        media_extended: [{ type: "image", url: "https://image.url" }],
      }));

      const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

      expect(mockHttpClient.fetch).toHaveBeenCalledWith("https://api.vxtwitter.com/johndoe/status/12345");
      expect(result.title).toBe("Tweet by John Doe (@johndoe)");
      expect(result.content).toBe(
        "John Doe (@johndoe) · 2023-10-01T12:00:00Z\n\nHello world!\n\nEngagement: 100 likes\n\nSource: https://x.com/johndoe/status/12345"
      );
      expect(result.images).toEqual([{ url: "https://image.url", alt: "Tweet image" }]);
    });

    it("should include quoted tweet in content when present", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(makeResponse({
        text: "Interesting take!",
        user_name: "Jane",
        user_screen_name: "jane",
        date: "2023-10-02T09:00:00Z",
        qrt: { text: "Original thought", user_name: "Bob", user_screen_name: "bob" },
      }));

      const result = await twitterService.scrape("https://x.com/jane/status/99");

      expect(result.content).toContain("[Quoted tweet by Bob (@bob)]");
      expect(result.content).toContain("Original thought");
    });

    it("should include thread continuation in content when present", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(makeResponse({
        text: "Part 1",
        user_name: "Alice",
        user_screen_name: "alice",
        thread: [{ text: "Part 2" }, { text: "Part 3" }],
      }));

      const result = await twitterService.scrape("https://x.com/alice/status/1");

      expect(result.content).toContain("[Thread continues]");
      expect(result.content).toContain("Part 2");
      expect(result.content).toContain("Part 3");
    });

    it("should extract video thumbnail as image and video url as link", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(makeResponse({
        text: "Watch this",
        user_name: "Alice",
        user_screen_name: "alice",
        media_extended: [{
          type: "video",
          url: "https://video.url/clip.mp4",
          thumbnail_url: "https://thumb.url/preview.jpg",
        }],
      }));

      const result = await twitterService.scrape("https://x.com/alice/status/2");

      expect(result.images).toEqual([{ url: "https://thumb.url/preview.jpg", alt: "Tweet video thumbnail" }]);
      expect(result.links).toEqual([{ url: "https://video.url/clip.mp4", text: "Tweet video" }]);
    });

    it("should fall back to OG metadata when vxtwitter fails", async () => {
      mockHttpClient.fetch
        .mockResolvedValueOnce(makeResponse({}, false))
        .mockResolvedValueOnce({
          body: `<html><head>
            <meta property="og:title" content="OG Tweet Title" />
            <meta property="og:description" content="OG description" />
            <meta property="og:image" content="https://og-image.url" />
          </head></html>`,
          status: 200,
          ok: true,
          statusText: "OK",
          headers: new Headers() as any,
          arrayBuffer: async () => new ArrayBuffer(0),
        });

      const result = await twitterService.scrape("https://x.com/user/status/fallback");

      expect(result.title).toBe("OG Tweet Title");
      expect(result.content).toContain("OG description");
      expect(result.images).toEqual([{ url: "https://og-image.url", alt: "Tweet preview" }]);
    });

    it("should throw TwitterScrapingError when both vxtwitter and OG fallback fail", async () => {
      mockHttpClient.fetch
        .mockResolvedValueOnce(makeResponse({}, false))
        .mockResolvedValueOnce(makeResponse({}, false));

      await expect(twitterService.scrape("https://x.com/user/status/gone")).rejects.toBeInstanceOf(
        TwitterScrapingError
      );
    });

    it("should throw TwitterScrapingError when vxtwitter response has no user data", async () => {
      mockHttpClient.fetch
        .mockResolvedValueOnce(makeResponse({ text: "hello" }))
        .mockResolvedValueOnce(makeResponse({}, false));

      await expect(twitterService.scrape("https://x.com/user/status/private")).rejects.toBeInstanceOf(
        TwitterScrapingError
      );
    });
  });
});
