import { CheerioAPI } from "cheerio";
import {
  OpenGraphMetadata,
  BookmarkMetadata,
  ScrapedUrlContents,
} from "../types";
import * as cheerio from "cheerio";

export interface WebScrapingService {
  isValidUrl(url: string): boolean;
  scrape(
    url: string
  ): Promise<
    Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  >;
  scrapeContent(
    url: string,
    content: string
  ): Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">;
}

export class WebScrapingServiceImpl implements WebScrapingService {
  private readonly requestTimeout = 10000; // 10 seconds

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }

  async scrape(
    url: string
  ): Promise<
    Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  > {
    console.log("Scraping URL:", url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const content = await response.text();
      const scrapedUrlContents = this.scrapeContent(url, content);

      return scrapedUrlContents;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout: URL took too long to respond");
      }
      throw error;
    }
  }

  scrapeContent(
    url: string,
    content: string
  ): Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId"> {
    const $ = cheerio.load(content);
    $("script").remove();
    $("style").remove();

    const body = $("body").html() ?? content;

    const metadata = this.extractMetadata(url, $);
    const title = metadata.openGraph?.title || this.extractTitle($);
    const images = this.extractImages($);
    const links = this.extractLinks($);
    return { title, content: body, metadata, images, links };
  }

  private extractTitle($: CheerioAPI): ScrapedUrlContents["title"] {
    return $("h1").text() ?? "";
  }

  private extractImages($: CheerioAPI): ScrapedUrlContents["images"] {
    const images = $("img");
    return images
      .map((i, img) => {
        return {
          url: $(img).attr("src") ?? "",
          alt: $(img).attr("alt") ?? "",
        };
      })
      .get();
  }

  private extractLinks($: CheerioAPI): ScrapedUrlContents["links"] {
    return $("a")
      .map((i, link) => {
        return {
          url: $(link).attr("href") ?? "",
          text: $(link).text() ?? "",
        };
      })
      .get();
  }

  private extractMetadata(sourceUrl: string, $: CheerioAPI): BookmarkMetadata {
    const ogData = this.extractOpenGraphMetadata(sourceUrl, $);

    const textContent = $.root().text();
    const wordCount = textContent
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    const readingTime = Math.ceil(wordCount / 200);

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href");

    if (favicon && !favicon.startsWith("http")) {
      const url = new URL(ogData.url || sourceUrl);
      favicon = new URL(favicon, url.origin).href;
    }

    ogData.favicon = favicon;

    return {
      openGraph: ogData,
      wordCount,
      readingTime,
    };
  }

  private extractOpenGraphMetadata(
    sourceUrl: string,
    $: CheerioAPI
  ): OpenGraphMetadata {
    const ogData: OpenGraphMetadata = {};

    $('meta[property^="og:"]').each((_: number, element: any) => {
      const property = $(element).attr("property");
      const content = $(element).attr("content");

      if (property && content) {
        switch (property) {
          case "og:title":
            ogData.title = content;
            break;
          case "og:description":
            ogData.description = content;
            break;
          case "og:image":
            ogData.image = content;
            break;
          case "og:url":
            ogData.url = content;
            break;
          case "og:site_name":
            ogData.site_name = content;
            break;
          case "og:type":
            ogData.type = content;
            break;
          case "og:locale":
            ogData.locale = content;
            break;
          case "og:article:author":
            ogData.article_author = content;
            break;
          case "og:article:published_time":
            ogData.article_published_time = content;
            break;
          case "og:article:modified_time":
            ogData.article_modified_time = content;
            break;
          case "og:article:section":
            ogData.article_section = content;
            break;
          case "og:article:tag":
            if (!ogData.article_tag) ogData.article_tag = [];
            ogData.article_tag.push(content);
            break;
        }
      }
    });

    if (!ogData.title) {
      ogData.title = $("title").first().text().trim() || undefined;
    }

    if (!ogData.description) {
      ogData.description =
        $('meta[name="description"]').attr("content") || undefined;
    }

    if (!ogData.url) {
      ogData.url = sourceUrl;
    }

    return ogData;
  }
}
