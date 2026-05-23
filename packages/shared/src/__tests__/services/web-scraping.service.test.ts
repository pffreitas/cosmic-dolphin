import { WebScrapingServiceImpl } from "../../services/web-scraping.service";
import { HttpClient } from "../../services/http-client";
import { YouTubeService } from "../../services/youtube.service";
import { TwitterService } from "../../services/twitter.service";

describe("WebScrapingService", () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockYouTubeService: jest.Mocked<YouTubeService>;
  let mockTwitterService: jest.Mocked<TwitterService>;
  let webScrapingService: WebScrapingServiceImpl;

  beforeEach(() => {
    mockHttpClient = {
      fetch: jest.fn(),
    } as any;
    mockYouTubeService = {
      isYouTubeUrl: jest.fn().mockReturnValue(false),
      scrape: jest.fn(),
    } as any;
    mockTwitterService = {
      isTwitterUrl: jest.fn().mockReturnValue(false),
      scrape: jest.fn(),
    } as any;

    webScrapingService = new WebScrapingServiceImpl(
      mockHttpClient,
      mockYouTubeService,
      mockTwitterService
    );
  });

  describe("isValidUrl", () => {
    it("should allow public URLs", () => {
      expect(webScrapingService.isValidUrl("https://example.com")).toBe(true);
      expect(webScrapingService.isValidUrl("http://10.example.com")).toBe(true);
    });

    it("should block internal network and loopback addresses (SSRF protection)", () => {
      expect(webScrapingService.isValidUrl("http://localhost")).toBe(false);
      expect(webScrapingService.isValidUrl("http://127.0.0.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://10.0.0.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://192.168.1.1")).toBe(false);
      expect(webScrapingService.isValidUrl("http://169.254.169.254")).toBe(false);
      expect(webScrapingService.isValidUrl("http://[::1]")).toBe(false);
      expect(webScrapingService.isValidUrl("http://2130706433")).toBe(false); // 127.0.0.1 as integer
    });
  });

  describe("scrape", () => {
    it("should route twitter URLs to TwitterService", async () => {
      mockTwitterService.isTwitterUrl.mockReturnValue(true);
      mockTwitterService.scrape.mockResolvedValue({ title: "Twitter Test" } as any);

      const result = await webScrapingService.scrape("https://x.com/user/status/123");

      expect(mockTwitterService.isTwitterUrl).toHaveBeenCalledWith("https://x.com/user/status/123");
      expect(mockTwitterService.scrape).toHaveBeenCalledWith("https://x.com/user/status/123");
      expect(result.title).toBe("Twitter Test");
    });

    it("should fallback to regular scraping for other URLs", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce({
        body: "<html><body><h1>Regular Page</h1></body></html>",
        status: 200,
        ok: true,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/html" }) as any,
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      const result = await webScrapingService.scrape("https://example.com");

      expect(mockYouTubeService.isYouTubeUrl).toHaveBeenCalledWith("https://example.com");
      expect(mockTwitterService.isTwitterUrl).toHaveBeenCalledWith("https://example.com");
      expect(result.title).toBe("Regular Page");
    });
  });
});
