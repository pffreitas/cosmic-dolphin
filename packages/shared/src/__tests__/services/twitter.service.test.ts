import { TwitterServiceImpl, TwitterScrapingError } from "../../services/twitter.service";
import { HttpClient } from "../../services/http-client";

const makeJsonResponse = (body: object, ok = true) => ({
  body: JSON.stringify(body),
  status: ok ? 200 : 404,
  ok,
  statusText: ok ? "OK" : "Not Found",
  headers: new Headers() as any,
  arrayBuffer: async () => new ArrayBuffer(0),
});

const makeHtmlResponse = (html: string) => ({
  body: html,
  status: 200,
  ok: true,
  statusText: "OK",
  headers: new Headers() as any,
  arrayBuffer: async () => new ArrayBuffer(0),
});

// Helpers to build fxTwitter v2 API responses
const fxResponse = (overrides: Record<string, unknown> = {}) =>
  makeJsonResponse({
    code: 200,
    status: {
      text: "Hello world!",
      author: { name: "John Doe", screen_name: "johndoe" },
      created_at: "2023-10-01T12:00:00Z",
      likes: 100,
      reposts: 50,
      replies: 10,
      ...overrides,
    },
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
    it("should build structured content from fxtwitter v2 response", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        media: { photos: [{ type: "photo", url: "https://image.url", altText: "photo alt" }] },
      }));

      const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

      expect(mockHttpClient.fetch).toHaveBeenCalledWith("https://api.fxtwitter.com/2/12345");
      expect(result.title).toBe("Tweet by John Doe (@johndoe)");
      expect(result.content).toBe(
        "John Doe (@johndoe) · 2023-10-01T12:00:00Z\n\nHello world!\n\nEngagement: 100 likes · 50 retweets · 10 replies\n\nSource: https://x.com/johndoe/status/12345"
      );
      expect(result.images).toEqual([{ url: "https://image.url", alt: "photo alt" }]);
    });

    it("should work for twitter.com URLs, extracting the status ID", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse());

      await twitterService.scrape("https://twitter.com/johndoe/status/99999");

      expect(mockHttpClient.fetch).toHaveBeenCalledWith("https://api.fxtwitter.com/2/99999");
    });

    it("should include quoted tweet in content when present", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        text: "Interesting take!",
        author: { name: "Jane", screen_name: "jane" },
        quote: { text: "Original thought", author: { name: "Bob", screen_name: "bob" } },
      }));

      const result = await twitterService.scrape("https://x.com/jane/status/99");

      expect(result.content).toContain("[Quoted tweet by Bob (@bob)]");
      expect(result.content).toContain("Original thought");
    });

    it("should include thread continuation when present in top-level thread array", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(
        makeJsonResponse({
          code: 200,
          status: {
            text: "Part 1",
            author: { name: "Alice", screen_name: "alice" },
          },
          thread: [{ text: "Part 2" }, { text: "Part 3" }],
        })
      );

      const result = await twitterService.scrape("https://x.com/alice/status/1");

      expect(result.content).toContain("[Thread continues]");
      expect(result.content).toContain("Part 2");
      expect(result.content).toContain("Part 3");
    });

    it("should extract video thumbnail as image and video url as link", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        text: "Watch this",
        author: { name: "Alice", screen_name: "alice" },
        media: {
          videos: [{
            type: "video",
            url: "https://video.url/clip.mp4",
            thumbnail_url: "https://thumb.url/preview.jpg",
          }],
        },
      }));

      const result = await twitterService.scrape("https://x.com/alice/status/2");

      expect(result.images).toEqual([{ url: "https://thumb.url/preview.jpg", alt: "Tweet video thumbnail" }]);
      expect(result.links).toEqual([{ url: "https://video.url/clip.mp4", text: "Tweet video" }]);
    });

    it("should label gif thumbnails in photos as 'Tweet GIF'", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        media: { photos: [{ type: "gif", url: "https://gif.url/anim.gif" }] },
      }));

      const result = await twitterService.scrape("https://x.com/alice/status/3");

      expect(result.images).toEqual([{ url: "https://gif.url/anim.gif", alt: "Tweet GIF" }]);
    });

    it("should fall back to oEmbed when fxtwitter fails", async () => {
      mockHttpClient.fetch
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))
        .mockResolvedValueOnce(makeJsonResponse({
          author_name: "jack",
          author_url: "https://twitter.com/jack",
          html: '<blockquote class="twitter-tweet"><p lang="en">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://twitter.com/jack/status/20">March 21, 2006</a></blockquote>',
          provider_name: "Twitter",
        }));

      const result = await twitterService.scrape("https://x.com/jack/status/20");

      expect(result.title).toBe("Tweet by jack");
      expect(result.content).toContain("just setting up my twttr");
      expect(result.metadata.openGraph?.site_name).toBe("X (formerly Twitter)");
    });

    it("should fall back to OG metadata when fxtwitter and oEmbed both fail", async () => {
      mockHttpClient.fetch
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))  // fxTwitter fetch
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))  // oEmbed fetch
        .mockResolvedValueOnce(makeHtmlResponse(`<html><head>
          <meta property="og:title" content="OG Tweet Title" />
          <meta property="og:description" content="OG description" />
          <meta property="og:image" content="https://og-image.url" />
        </head></html>`));                                         // OG fetch

      const result = await twitterService.scrape("https://x.com/user/status/11111");

      expect(result.title).toBe("OG Tweet Title");
      expect(result.content).toContain("OG description");
      expect(result.images).toEqual([{ url: "https://og-image.url", alt: "Tweet preview" }]);
    });

    it("should throw TwitterScrapingError when all three methods fail", async () => {
      mockHttpClient.fetch
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))  // fxTwitter fetch
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))  // oEmbed fetch
        .mockRejectedValueOnce(new Error("HTTP 403: Forbidden")); // OG fetch

      await expect(twitterService.scrape("https://x.com/user/status/22222")).rejects.toBeInstanceOf(
        TwitterScrapingError
      );
    });

    it("should throw TwitterScrapingError when fxtwitter response has no author data", async () => {
      mockHttpClient.fetch
        .mockResolvedValueOnce(makeJsonResponse({ code: 200, status: { text: "hello" } }))  // fxTwitter: missing author
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))                            // oEmbed fetch
        .mockRejectedValueOnce(new Error("HTTP 403: Forbidden"));                           // OG fetch

      await expect(twitterService.scrape("https://x.com/user/status/33333")).rejects.toBeInstanceOf(
        TwitterScrapingError
      );
    });

    it("should throw TwitterScrapingError for non-tweet URLs that cannot be scraped", async () => {
      mockHttpClient.fetch
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"))
        .mockRejectedValueOnce(new Error("Could not extract tweet ID from URL for oEmbed"))
        .mockRejectedValueOnce(new Error("HTTP 403: Forbidden"));

      await expect(twitterService.scrape("https://x.com/i/notes/abc123")).rejects.toBeInstanceOf(
        TwitterScrapingError
      );
    });
  });
});
