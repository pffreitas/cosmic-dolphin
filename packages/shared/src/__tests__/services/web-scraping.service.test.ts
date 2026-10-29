import { WebScrapingServiceImpl } from "../../services/web-scraping.service";
import { HttpClient, HttpRequestError } from "../../services/http-client";
import { YouTubeService } from "../../services/youtube.service";
import { TwitterService } from "../../services/twitter.service";
import { PageExtractionProvider } from "../../services/extraction-providers";

const htmlResponse = (body: string) => ({
  body, status: 200, ok: true, statusText: "OK",
  headers: new Headers({ "content-type": "text/html" }),
  arrayBuffer: async () => new ArrayBuffer(0),
});

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
      mockTwitterService,
      []
    );
  });

  describe("scrape", () => {
    it("reads public articles with sign-in navigation and authentication terminology", async () => {
      const article = "A public article about authentication. Users sign in to manage their account, but this documentation is public. ".repeat(4);
      mockHttpClient.fetch.mockResolvedValue(htmlResponse(`<title>Public documentation</title><nav>Sign in</nav><main><article><h1>Authentication guide</h1><p>${article}</p></article></main>`));
      const result = await webScrapingService.scrape("https://example.com/guide");
      expect(result.content).toContain("this documentation is public");
      expect(result.content).not.toContain("<nav>");
      expect(result.metadata.extraction?.provider).toBe("direct");
    });

    it("extracts a repository README before its surrounding main navigation", async () => {
      mockHttpClient.fetch.mockResolvedValue(htmlResponse(`<main><p>Repository navigation Sign in Notifications Fork Star</p><article><h1>OmniRoute</h1><p>${"README installation and usage details. ".repeat(10)}</p></article></main>`));
      const result = await webScrapingService.scrape("https://github.com/cheaper-inference/OmniRoute");
      expect(result.content).toContain("README installation");
      expect(result.content).not.toContain("Repository navigation");
    });

    it("resolves article links and lazy images against the final page URL", async () => {
      mockHttpClient.fetch.mockResolvedValue({
        ...htmlResponse('<h1>Public guide</h1><p>Some useful page text.</p><a href="next">Read more</a><img data-src="image.png" onerror="alert(1)"><a href="javascript:alert(1)">Bad link</a>'),
        redirectUrl: "https://example.com/docs/page",
      });
      const result = await webScrapingService.scrape("https://example.com/old");
      expect(result.content).toContain('href="https://example.com/docs/next"');
      expect(result.content).toContain('src="https://example.com/docs/image.png"');
      expect(result.content).not.toMatch(/javascript:|onerror/);
    });

    it("does not mistake /authors for an authentication redirect", async () => {
      mockHttpClient.fetch.mockResolvedValue({ ...htmlResponse('<h1>Author profile</h1><p>Some public writing.</p>'), redirectUrl: "https://example.com/authors/jane" });
      await expect(webScrapingService.scrape("https://example.com/jane")).resolves.toBeDefined();
    });

    describe("rendered fallback", () => {
      let provider: jest.Mocked<PageExtractionProvider>;
      beforeEach(() => {
        provider = { extract: jest.fn().mockResolvedValue({ html: '<h1>Recovered public page</h1><p>Readable recovered page content.</p>', title: "Recovered title", provider: "firecrawl" }) };
        webScrapingService = new WebScrapingServiceImpl(mockHttpClient, mockYouTubeService, mockTwitterService, provider);
      });

      it.each([403, 429, 503])("recovers HTTP %s through the alternate provider", async (status) => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError(`HTTP ${status}`, status));
        const result = await webScrapingService.scrape("https://example.com/public");
        expect(provider.extract).toHaveBeenCalledWith("https://example.com/public");
        expect(result.content).toContain("Readable recovered page content");
        expect(result.metadata.extraction?.provider).toBe("firecrawl");
      });

      it.each([
        '<title>Just a moment...</title><p>Checking your browser before continuing</p>',
        '<title>Public SPA</title><div id="app">Loading your article...</div>',
        '<title>Public SPA</title><meta name="description" content="Metadata is not page content"><div id="root"></div>',
        '<title>Public SPA</title><p>You need to enable JavaScript to run this app.</p>',
      ])("recovers challenge pages and client-rendered shells", async (html) => {
        mockHttpClient.fetch.mockResolvedValue(htmlResponse(html));
        await webScrapingService.scrape("https://example.com/public");
        expect(provider.extract).toHaveBeenCalledTimes(1);
      });

      it("validates each rendered result before advancing to the next provider", async () => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError("HTTP 403", 403));
        const browser = { extract: jest.fn().mockResolvedValue({ html: '<h1>Just a moment</h1>', provider: "lightpanda" }) };
        webScrapingService = new WebScrapingServiceImpl(mockHttpClient, mockYouTubeService, mockTwitterService, [browser, provider]);
        const result = await webScrapingService.scrape("https://example.com/public");
        expect(browser.extract).toHaveBeenCalledTimes(1);
        expect(provider.extract).toHaveBeenCalledTimes(1);
        expect(result.metadata.extraction?.provider).toBe("firecrawl");
      });

      it("records browser provenance and stops before paid extraction when recovered", async () => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError("HTTP 403", 403));
        const browser = { extract: jest.fn().mockResolvedValue({ html: '<article>Recovered actual article content.</article>', provider: "lightpanda" }) };
        webScrapingService = new WebScrapingServiceImpl(mockHttpClient, mockYouTubeService, mockTwitterService, [browser, provider]);
        expect((await webScrapingService.scrape("https://example.com/public")).metadata.extraction?.provider).toBe("lightpanda");
        expect(provider.extract).not.toHaveBeenCalled();
      });

      it("does not advance past a terminal browser authentication result", async () => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError("HTTP 403", 403));
        const browser = { extract: jest.fn().mockResolvedValue({ html: '<h1>Sign in</h1>', finalUrl: "https://example.com/login" }) };
        webScrapingService = new WebScrapingServiceImpl(mockHttpClient, mockYouTubeService, mockTwitterService, [browser, provider]);
        await expect(webScrapingService.scrape("https://example.com/public")).rejects.toMatchObject({ code: "auth", shouldRetry: false });
        expect(provider.extract).not.toHaveBeenCalled();
      });

      it.each([401, 404, 410])("does not spend a fallback request on terminal HTTP %s", async (status) => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError(`HTTP ${status}`, status));
        await expect(webScrapingService.scrape("https://example.com/private")).rejects.toMatchObject({ shouldRetry: false });
        expect(provider.extract).not.toHaveBeenCalled();
      });

      it("does not send login redirects to the fallback", async () => {
        mockHttpClient.fetch.mockResolvedValue({ ...htmlResponse('<h1>Sign in</h1>'), redirectUrl: "https://example.com/login" });
        await expect(webScrapingService.scrape("https://example.com/private")).rejects.toMatchObject({ code: "auth", shouldRetry: false });
        expect(provider.extract).not.toHaveBeenCalled();
      });

      it("rejects challenges returned by the fallback too", async () => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError("HTTP 403", 403));
        provider.extract.mockResolvedValue({ html: '<h1>Just a moment...</h1><p>Checking your browser</p>' });
        await expect(webScrapingService.scrape("https://example.com/public")).rejects.toMatchObject({ code: "blocked", shouldRetry: true });
      });

      it("uses only the direct path for healthy pages", async () => {
        mockHttpClient.fetch.mockResolvedValue(htmlResponse('<h1>A public page</h1><p>Real page content.</p>'));
        await webScrapingService.scrape("https://example.com/public");
        expect(provider.extract).not.toHaveBeenCalled();
      });

      it("does not render or incur paid extraction during URL-card previews", async () => {
        mockHttpClient.fetch.mockRejectedValue(new HttpRequestError("HTTP 403", 403));
        await expect(webScrapingService.scrape("https://example.com/public", { metadataOnly: true })).rejects.toBeDefined();
        expect(provider.extract).not.toHaveBeenCalled();
      });
    });

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

    it("should reject contentless authenticated app shells", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce({
        body: `
          <!doctype html>
          <html>
            <head>
              <title>Jira</title>
              <meta name="application-name" content="JIRA" />
            </head>
            <body>
              <div id="root"></div>
              <script>window.__SPA_BOOTSTRAP__ = {}</script>
            </body>
          </html>
        `,
        status: 200,
        ok: true,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/html" }) as any,
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      await expect(
        webScrapingService.scrape(
          "https://ab-inbev.atlassian.net/browse/BEESIP-33999"
        )
      ).rejects.toThrow("Scraped content is not usable");
    });
  });
});
