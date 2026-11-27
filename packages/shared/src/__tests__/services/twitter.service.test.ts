import { TwitterServiceImpl, TwitterScrapingError, xPostOnlyContent } from "../../services/twitter.service";
import { BrowserExtractionProvider } from "../../services/extraction-providers";
import { ContentExtractionError } from "../../services/content-extraction";
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

// Synthetic FxTwitter `/2/thread/{id}` responses, shaped like the live API.
const post = (overrides: Record<string, unknown> = {}) => ({
  type: "status",
  id: "12345",
  text: "Hello world!",
  author: { name: "John Doe", screen_name: "johndoe" },
  created_at: "Sun Nov 22 19:46:00 +0000 2026",
  created_timestamp: 1795376760,
  likes: 100,
  reposts: 50,
  replies: 10,
  ...overrides,
});
const thread = (focal: Record<string, unknown>, rest: Record<string, unknown>[] = [focal]) =>
  makeJsonResponse({ code: 200, status: focal, thread: rest });
const fxResponse = (overrides: Record<string, unknown> = {}) => thread(post(overrides));
const linkPost = (overrides: Record<string, unknown> = {}) =>
  post({
    text: "Wrote up how we shipped faster.\n\nhttps://blog.example.com/shipping-faster/",
    raw_text: {
      text: "Wrote up how we shipped faster.\n\nhttps://t.co/AAAA https://t.co/BBBB",
      facets: [
        { type: "url", original: "https://t.co/AAAA", replacement: "https://blog.example.com/shipping-faster/" },
        { type: "media", original: "https://t.co/BBBB", replacement: "https://x.com/johndoe/status/12345/photo/1" },
      ],
    },
    media: { photos: [{ type: "photo", url: "https://pbs.example/chart.jpg", altText: "Throughput chart" }] },
    ...overrides,
  });
const article = {
  title: "Shipping faster",
  content: "<h1>Shipping faster</h1><p>Bottleneck after bottleneck.</p><img src=\"https://blog.example.com/a.png\" alt=\"Article chart\">",
  images: [{ url: "https://blog.example.com/a.png", alt: "Article chart" }],
  links: [{ url: "https://blog.example.com/about", text: "About" }],
  metadata: { extraction: { status: "complete" as const, provider: "direct" } },
};

describe("TwitterService", () => {
  let mockHttpClient: jest.Mocked<HttpClient>;
  let twitterService: TwitterServiceImpl;
  let browser: jest.Mocked<BrowserExtractionProvider>;

  beforeEach(() => {
    mockHttpClient = {
      fetch: jest.fn(),
      post: jest.fn(),
      get: jest.fn(),
    } as any;
    browser = { extract: jest.fn(), extractYouTube: jest.fn(), extractTweet: jest.fn().mockRejectedValue(new Error("Browser unavailable")) };
    twitterService = new TwitterServiceImpl(mockHttpClient, browser);
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
    it("reads the thread endpoint with expanded text, photos and provenance", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(thread(post({
        text: "Hello world! https://t.co/CCCC",
        raw_text: { text: "Hello world! https://t.co/CCCC", facets: [{ type: "media", original: "https://t.co/CCCC" }] },
        media: { photos: [{ type: "photo", url: "https://image.url", altText: "photo alt" }] },
      })));

      const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

      expect(mockHttpClient.fetch).toHaveBeenCalledWith("https://api.fxtwitter.com/2/thread/12345");
      expect(result.title).toBe("Tweet by John Doe (@johndoe)");
      expect(result.content).toBe("John Doe (@johndoe) · 2026-11-22\n\nHello world!");
      expect(result.images).toEqual([{ url: "https://image.url", alt: "photo alt" }]);
      expect(result.metadata.openGraph).toMatchObject({ description: "Hello world!", image: "https://image.url", site_name: "X (formerly Twitter)" });
      expect(result.metadata.extraction).toMatchObject({ status: "complete", provider: "fxtwitter" });
      expect(result.metadata.extraction?.linked).toBeUndefined();
    });

    it("should work for twitter.com URLs, extracting the status ID", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse());

      await twitterService.scrape("https://twitter.com/johndoe/status/99999");

      expect(mockHttpClient.fetch).toHaveBeenCalledWith("https://api.fxtwitter.com/2/thread/99999");
    });

    it("keeps the author's thread order and shows the focal post once", async () => {
      const opening = post({ id: "1", text: "Part 1" });
      const focal = post({ id: "2", text: "Part 2" });
      mockHttpClient.fetch.mockResolvedValueOnce(thread(focal, [opening, focal, post({ id: "3", text: "Part 3" })]));

      const result = await twitterService.scrape("https://x.com/johndoe/status/2");

      expect(result.content).toBe([
        "John Doe (@johndoe) · 2026-11-22", "Part 1",
        "John Doe (@johndoe) · 2026-11-22", "Part 2",
        "John Doe (@johndoe) · 2026-11-22", "Part 3",
      ].join("\n\n"));
    });

    it("includes an available quote after its post and drops an unavailable one", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        text: "Interesting take!",
        quote: post({ id: "9", text: "Original thought", author: { name: "Bob", screen_name: "bob" } }),
      }));
      const quoted = await twitterService.scrape("https://x.com/johndoe/status/12345");
      expect(quoted.content).toBe("John Doe (@johndoe) · 2026-11-22\n\nInteresting take!\n\nQuoting Bob (@bob) · 2026-11-22\n\nOriginal thought");

      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({ text: "Interesting take!", quote: { type: "tombstone", text: "" } }));
      const unavailable = await twitterService.scrape("https://x.com/johndoe/status/12345");
      expect(unavailable.content).toBe("John Doe (@johndoe) · 2026-11-22\n\nInteresting take!");
    });

    it("drops generated engagement, source and media lines", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        text: "Watch this pic.x.com/abcd",
        media: { videos: [{ type: "video", url: "https://video.url/clip.mp4", thumbnail_url: "https://thumb.url/preview.jpg" }] },
      }));

      const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

      expect(result.content).toBe("John Doe (@johndoe) · 2026-11-22\n\nWatch this");
      expect(result.content).not.toMatch(/Engagement|Source:|t\.co|pic\.x\.com/);
      expect(result.images).toEqual([{ url: "https://thumb.url/preview.jpg", alt: "Tweet video thumbnail" }]);
      expect(result.links).toEqual([]);
      expect(result.metadata.openGraph?.image).toBeUndefined();
    });

    it("should label gif thumbnails in photos as 'Tweet GIF'", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse({
        media: { photos: [{ type: "gif", url: "https://gif.url/anim.gif" }] },
      }));

      const result = await twitterService.scrape("https://x.com/alice/status/3");

      expect(result.images).toEqual([{ url: "https://gif.url/anim.gif", alt: "Tweet GIF" }]);
    });

    describe("one eligible link", () => {
      let reader: jest.Mock;
      let info: jest.SpyInstance;
      beforeEach(() => {
        reader = jest.fn().mockResolvedValue(article);
        info = jest.spyOn(console, "info").mockImplementation(() => undefined);
        twitterService = new TwitterServiceImpl(mockHttpClient, browser, reader);
      });
      afterEach(() => info.mockRestore());

      it("stores the post before the readable article, with post photos only", async () => {
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost()));

        const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

        expect(reader).toHaveBeenCalledWith("https://blog.example.com/shipping-faster", expect.objectContaining({ quiet: true }));
        expect(result.content).toBe([
          "<blockquote>",
          "<p><strong>John Doe</strong> @johndoe · <time>2026-11-22</time></p>",
          "<p>Wrote up how we shipped faster.</p>",
          '<p><a href="https://blog.example.com/shipping-faster/">https://blog.example.com/shipping-faster/</a></p>',
          "</blockquote>",
          "<article>",
          article.content,
          "</article>",
        ].join("\n"));
        expect(result.metadata.extraction).toMatchObject({
          provider: "fxtwitter",
          linked: { url: "https://blog.example.com/shipping-faster", status: "complete", title: "Shipping faster" },
        });
        expect(result.images).toEqual([{ url: "https://pbs.example/chart.jpg", alt: "Throughput chart" }]);
        expect(result.metadata.openGraph?.image).toBe("https://pbs.example/chart.jpg");
        expect(result.links).toEqual([
          { url: "https://blog.example.com/shipping-faster/", text: "https://blog.example.com/shipping-faster/" },
          { url: "https://blog.example.com/about", text: "About" },
        ]);
        // Byline (5) + post (7) + article heading and paragraph (5).
        expect(result.metadata.wordCount).toBe(17);
        expect(result.metadata.readingTime).toBe(1);
      });

      it("escapes post text and quotes inside the linked row", async () => {
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost({
          raw_text: {
            text: "<b>bold</b> & https://t.co/AAAA",
            facets: [{ type: "url", original: "https://t.co/AAAA", replacement: "https://blog.example.com/shipping-faster/" }],
          },
          quote: post({ id: "7", text: "Quoted <i>words</i>", author: { name: "Bob", screen_name: "bob" } }),
        })));

        const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

        expect(result.content).toContain('<p>&lt;b&gt;bold&lt;/b&gt; &amp; <a href="https://blog.example.com/shipping-faster/">https://blog.example.com/shipping-faster/</a></p>');
        expect(result.content).toContain("<blockquote>\n<p>Quoting <strong>Bob</strong> @bob · <time>2026-11-22</time></p>\n<p>Quoted &lt;i&gt;words&lt;/i&gt;</p>\n</blockquote>\n<article>");
      });

      it("recovers the post-only body, links and counts from a linked row", async () => {
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost({
          quote: post({ id: "7", text: "See https://quoted.example.com/x", author: { name: "Bob", screen_name: "bob" },
            raw_text: { text: "See https://t.co/QQ", facets: [{ type: "url", original: "https://t.co/QQ", replacement: "https://quoted.example.com/x" }] } }),
        })));
        const linked = await twitterService.scrape("https://x.com/johndoe/status/12345");

        const postOnly = xPostOnlyContent(linked.content);

        expect(postOnly.content).toBe(linked.content.slice(0, linked.content.indexOf("\n<article>")));
        expect(postOnly.links).toEqual([
          { url: "https://blog.example.com/shipping-faster/", text: "https://blog.example.com/shipping-faster/" },
          { url: "https://quoted.example.com/x", text: "https://quoted.example.com/x" },
        ]);
        // Two bylines (5 each), the post (7) and the quote (2).
        expect(postOnly).toMatchObject({ wordCount: 19, readingTime: 1 });
      });

      it("keeps a quote-only row when the follow fails", async () => {
        reader.mockRejectedValueOnce(new ContentExtractionError("Bot challenge", "blocked", true));
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost()));

        const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

        expect(result.content).not.toContain("<article>");
        expect(result.content).toMatch(/^<blockquote>[\s\S]*<\/blockquote>$/);
        expect(result.metadata.extraction?.linked).toEqual({ url: "https://blog.example.com/shipping-faster", status: "failed", error: "blocked" });
        expect(result.metadata.extraction?.status).toBe("complete");
      });

      it("rejects an invalid destination before the reader is called", async () => {
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost({
          raw_text: { text: "Look https://t.co/DDDD", facets: [{ type: "url", original: "https://t.co/DDDD", replacement: "http://192.168.1.10/admin" }] },
        })));

        const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

        expect(reader).not.toHaveBeenCalled();
        expect(result.metadata.extraction?.linked).toEqual({ url: "http://192.168.1.10/admin", status: "failed", error: "rejected_host" });
      });

      it.each([
        ["several eligible links", { raw_text: { text: "a https://t.co/1 b https://t.co/2", facets: [
          { type: "url", original: "https://t.co/1", replacement: "https://a.example.com/1" },
          { type: "url", original: "https://t.co/2", replacement: "https://b.example.com/2" },
        ] } }],
        ["only X and YouTube links", { raw_text: { text: "a https://t.co/1 b https://t.co/2", facets: [
          { type: "url", original: "https://t.co/1", replacement: "https://x.com/someone/status/5" },
          { type: "url", original: "https://t.co/2", replacement: "https://youtu.be/xyz" },
        ] } }],
      ])("makes no follow for %s", async (_name, overrides) => {
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost(overrides)));

        const result = await twitterService.scrape("https://x.com/johndoe/status/12345");

        expect(reader).not.toHaveBeenCalled();
        expect(result.metadata.extraction?.linked).toBeUndefined();
        expect(result.content).not.toContain("<blockquote>");
      });

      it("makes no follow for a preview", async () => {
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost()));

        const result = await twitterService.scrape("https://x.com/johndoe/status/12345", { metadataOnly: true });

        expect(reader).not.toHaveBeenCalled();
        expect(result.metadata.extraction?.linked).toBeUndefined();
      });

      it("propagates run cancellation during the follow without trying the fallbacks", async () => {
        const run = new AbortController();
        reader.mockImplementationOnce(() => {
          run.abort();
          return Promise.reject(new Error("aborted"));
        });
        mockHttpClient.fetch.mockResolvedValueOnce(thread(linkPost()));

        await expect(twitterService.scrape("https://x.com/johndoe/status/12345", { signal: run.signal })).rejects.toThrow();
        expect(mockHttpClient.fetch).toHaveBeenCalledTimes(1);
        expect(browser.extractTweet).not.toHaveBeenCalled();
      });
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
      expect(result.content).toBe("jack · March 21, 2006\n\njust setting up my twttr");
      expect(result.metadata.openGraph?.site_name).toBe("X (formerly Twitter)");
      expect(result.metadata.extraction?.provider).toBe("oembed");
    });

    it("recovers a targeted post in the browser before the OG fallback", async () => {
      mockHttpClient.fetch.mockRejectedValue(new Error("Provider unavailable"));
      browser.extractTweet.mockResolvedValue({ title: "Post by Alice", content: "Actual post text", images: [], links: [], metadata: { extraction: { status: "complete", provider: "lightpanda", fetchedAt: new Date().toISOString() } } });
      const result = await twitterService.scrape("https://x.com/alice/status/123");
      expect(result.content).toBe("Actual post text");
      expect(result.metadata.extraction?.provider).toBe("lightpanda");
      expect(mockHttpClient.fetch).toHaveBeenCalledTimes(2);
    });

    it("does not open a browser when APIs succeed or for previews", async () => {
      mockHttpClient.fetch.mockResolvedValueOnce(fxResponse());
      await twitterService.scrape("https://x.com/alice/status/123");
      mockHttpClient.fetch.mockRejectedValue(new Error("Blocked"));
      await expect(twitterService.scrape("https://x.com/alice/status/123", { metadataOnly: true })).rejects.toBeDefined();
      expect(browser.extractTweet).not.toHaveBeenCalled();
    });

    it("does not accept an empty oEmbed post instead of browser recovery", async () => {
      mockHttpClient.fetch.mockRejectedValueOnce(new Error("Blocked"))
        .mockResolvedValueOnce(makeJsonResponse({ author_name: "Alice", html: "<blockquote></blockquote>" }));
      browser.extractTweet.mockResolvedValue({ title: "Recovered", content: "Real post", images: [], links: [], metadata: {} });
      expect((await twitterService.scrape("https://x.com/alice/status/123")).content).toBe("Real post");
    });

    it("retains terminal browser authentication classification", async () => {
      mockHttpClient.fetch.mockRejectedValue(new Error("Blocked"));
      browser.extractTweet.mockRejectedValue(new ContentExtractionError("Private post", "auth", false));
      await expect(twitterService.scrape("https://x.com/alice/status/123")).rejects.toMatchObject({ code: "auth", shouldRetry: false });
      expect(mockHttpClient.fetch).toHaveBeenCalledTimes(2);
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
      expect(result.content).toBe("OG Tweet Title\n\nOG description");
      expect(result.metadata.extraction?.provider).toBe("opengraph");
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
