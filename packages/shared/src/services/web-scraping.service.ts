import { OpenGraphMetadata, BookmarkMetadata, FetchUrlResult } from "../types";
import * as cheerio from "cheerio";

export interface WebScrapingService {
  isValidUrl(url: string): boolean;
  validateAndFetchUrl(url: string): Promise<FetchUrlResult>;
  extractOpenGraphMetadata(html: string): OpenGraphMetadata;
  createBookmarkMetadata(
    ogData: OpenGraphMetadata,
    contentType: string,
    html: string
  ): BookmarkMetadata;
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

  async validateAndFetchUrl(url: string): Promise<FetchUrlResult> {
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
      return { content, contentType };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timeout: URL took too long to respond");
      }
      throw error;
    }
  }

  extractOpenGraphMetadata(html: string): OpenGraphMetadata {
    const $ = cheerio.load(html);
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

    return ogData;
  }

  createBookmarkMetadata(
    ogData: OpenGraphMetadata,
    contentType: string,
    html: string
  ): BookmarkMetadata {
    const $ = cheerio.load(html);

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
      const url = new URL(ogData.url || "");
      favicon = new URL(favicon, url.origin).href;
    }

    return {
      openGraph: ogData,
      title: ogData.title,
      description: ogData.description,
      favicon,
      contentType,
      wordCount,
      readingTime,
    };
  }
}
