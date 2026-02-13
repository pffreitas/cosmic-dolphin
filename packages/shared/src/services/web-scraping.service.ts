import { CheerioAPI } from "cheerio";
import {
  OpenGraphMetadata,
  BookmarkMetadata,
  ScrapedUrlContents,
} from "../types";
import * as cheerio from "cheerio";
import { HttpClient, CosmicHttpClient } from "./http-client";
import * as net from "net";

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

      // Strip brackets from IPv6 addresses
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.slice(1, -1);
      }

      // Block localhost
      if (hostname === "localhost" || hostname.endsWith(".localhost")) {
        return false;
      }

      // Check if hostname is an IP address and if it is private
      if (net.isIP(hostname) !== 0 && this.isPrivateIP(hostname)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private isPrivateIP(ip: string): boolean {
    if (net.isIPv4(ip)) {
      // 0.0.0.0 - Any
      if (ip === "0.0.0.0") return true;
      // 127.0.0.0/8 - Loopback
      if (ip.startsWith("127.")) return true;
      // 10.0.0.0/8 - Private
      if (ip.startsWith("10.")) return true;
      // 169.254.0.0/16 - Link-local
      if (ip.startsWith("169.254.")) return true;
      // 192.168.0.0/16 - Private
      if (ip.startsWith("192.168.")) return true;
      // 172.16.0.0/12 - Private
      if (ip.startsWith("172.")) {
        const parts = ip.split(".");
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
      return false;
    }

    if (net.isIPv6(ip)) {
      // ::1 - Loopback
      if (ip === "::1") return true;
      // :: - Any
      if (ip === "::") return true;
      // fe80::/10 - Link-local
      if (ip.toLowerCase().startsWith("fe80:")) return true;
      // fc00::/7 - Unique Local
      if (
        ip.toLowerCase().startsWith("fc") ||
        ip.toLowerCase().startsWith("fd")
      )
        return true;
      // IPv4-mapped IPv6 addresses for localhost
      if (ip.toLowerCase().includes("127.0.0.1")) return true;
      return false;
    }

    return false;
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
