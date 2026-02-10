import { CheerioAPI } from "cheerio";
import { isIP } from "net";
import {
  OpenGraphMetadata,
  BookmarkMetadata,
  ScrapedUrlContents,
} from "../types";
import * as cheerio from "cheerio";
import { HttpClient, CosmicHttpClient } from "./http-client";

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
  constructor(private httpClient: HttpClient = new CosmicHttpClient()) {}

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return false;
      }

      let hostname = urlObj.hostname;

      // IPv6 hostnames are enclosed in brackets in the URL object
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.slice(1, -1);
      }

      // Check for localhost
      if (hostname === "localhost" || hostname.endsWith(".localhost")) {
        return false;
      }

      // If it is NOT an IP address, we allow it (synchronous check limitation)
      // This prevents blocking valid domains like "10.com"
      if (isIP(hostname) === 0) {
        return true;
      }

      // IPv4 Checks
      // 0.0.0.0/8 (Current network)
      if (hostname.match(/^0\./)) return false;
      // 127.0.0.0/8 (Loopback)
      if (hostname.match(/^127\./)) return false;
      // 10.0.0.0/8 (Private network)
      if (hostname.match(/^10\./)) return false;
      // 192.168.0.0/16 (Private network)
      if (hostname.match(/^192\.168\./)) return false;
      // 169.254.0.0/16 (Link-local)
      if (hostname.match(/^169\.254\./)) return false;
      // 172.16.0.0/12 (Private network)
      if (hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return false;

      // IPv6 Checks
      // ::1 (Loopback)
      if (hostname === "::1") return false;
      // fc00::/7 (Unique Local)
      if (hostname.match(/^[fF][cCdD][0-9a-fA-F]{2}:/)) return false;
      // fe80::/10 (Link Local)
      if (hostname.match(/^[fF][eE][89abAB][0-9a-fA-F]:/)) return false;

      return true;
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

    try {
      const response = await this.httpClient.fetch(url);

      const contentType = response.headers.get("content-type") || "";

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const scrapedUrlContents = this.scrapeContent(url, response.body);
      return scrapedUrlContents;
    } catch (error) {
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
      .map((_, img) => {
        return {
          url: $(img).attr("src") ?? "",
          alt: $(img).attr("alt") ?? "",
        };
      })
      .get();
  }

  private extractLinks($: CheerioAPI): ScrapedUrlContents["links"] {
    return $("a")
      .map((_, link) => {
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
