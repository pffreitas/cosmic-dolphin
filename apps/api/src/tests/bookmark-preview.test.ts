import { describe, it, expect, mock } from "bun:test";
import {
  WebScrapingServiceImpl,
  HttpRequestError,
} from "@cosmic-dolphin/shared";
import { buildBookmarkPreviewResponse } from "../routes/bookmarks";

describe("bookmark previews", () => {
  const url = "https://example.com/public-page";

  it.each([403, 429, 503])(
    "keeps HTTP %s eligible for background recovery without paying during preview",
    async (status) => {
      const extract = mock(async () => ({ html: "<p>Recovered article</p>" }));
      const scraping = new WebScrapingServiceImpl(
        {
          fetch: async () => {
            throw new HttpRequestError(`HTTP ${status}`, status);
          },
        },
        undefined,
        undefined,
        { extract },
      );
      const preview = await buildBookmarkPreviewResponse(scraping, url);
      expect(preview.scrapable).toBe(true);
      expect(preview.metadata.url).toBe(url);
      expect(extract).not.toHaveBeenCalled();
    },
  );

  it("keeps empty JavaScript shells eligible for rendering in the worker", async () => {
    const scraping = new WebScrapingServiceImpl({
      fetch: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: '<title>App</title><div id="root"></div>',
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    });
    expect((await buildBookmarkPreviewResponse(scraping, url)).scrapable).toBe(
      true,
    );
  });

  it.each([401, 404, 410])(
    "retains the private-link fallback for terminal HTTP %s",
    async (status) => {
      const scraping = new WebScrapingServiceImpl({
        fetch: async () => {
          throw new HttpRequestError(`HTTP ${status}`, status);
        },
      });
      expect(
        (await buildBookmarkPreviewResponse(scraping, url)).scrapable,
      ).toBe(false);
    },
  );

  it("returns page metadata for a healthy public page", async () => {
    const scraping = new WebScrapingServiceImpl({
      fetch: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: "<title>Public article</title><h1>Public article</h1><p>Readable page content</p>",
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    });
    expect(await buildBookmarkPreviewResponse(scraping, url)).toMatchObject({
      scrapable: true,
      metadata: { title: "Public article" },
    });
  });
});
