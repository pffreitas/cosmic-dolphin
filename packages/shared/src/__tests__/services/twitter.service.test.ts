import { TwitterServiceImpl } from "../../services/twitter.service";
import { HttpClient } from "../../services/http-client";

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
      expect(twitterService.isTwitterUrl("https://google.com")).toBe(false);
    });
  });

  describe("scrape", () => {
    it("should fetch from vxtwitter and map to ScrapedUrlContents", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce({
        body: JSON.stringify({
          text: "Hello world!",
          user_name: "John Doe",
          user_screen_name: "johndoe",
          date: "2023-10-01T12:00:00Z",
          likes: 100,
          media_extended: [{ type: "image", url: "https://image.url" }]
        }),
        status: 200,
        ok: true,
        statusText: "OK",
        headers: new Headers() as any,
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

      expect(mockHttpClient.fetch).toHaveBeenCalledWith("https://api.vxtwitter.com/johndoe/status/12345");
      expect(result.title).toBe("Tweet by John Doe (@johndoe)");
      expect(result.content).toBe("Hello world!");
      expect(result.images).toEqual([{ url: "https://image.url", alt: "Tweet media" }]);
    });
  });
});
