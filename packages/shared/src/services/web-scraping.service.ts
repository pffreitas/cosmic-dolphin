import { CheerioAPI } from "cheerio";
import { isIP } from "node:net";
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

      // Handle IPv6 brackets (URL hostname includes brackets for IPv6)
      if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.slice(1, -1);
      }

      // Block localhost
      if (hostname === "localhost") {
        return false;
      }

      // Check if hostname is an IP address
      const ipVersion = isIP(hostname);
      if (ipVersion !== 0) {
        if (this.isPrivateIP(hostname, ipVersion)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private isPrivateIP(ip: string, version: number): boolean {
    if (version === 4) {
      // IPv4 checks
      const parts = ip.split(".").map(Number);
      if (parts.length !== 4) return false;

      // 10.0.0.0/8
      if (parts[0] === 10) return true;

      // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;

      // 127.0.0.0/8 (Loopback)
      if (parts[0] === 127) return true;

      // 169.254.0.0/16 (Link-local)
      if (parts[0] === 169 && parts[1] === 254) return true;

      return false;
    } else if (version === 6) {
      // IPv6 checks - simple string matching for common prefixes

      // Loopback ::1
      if (ip === "::1") return true;

      // Unique Local Address fc00::/7 (starts with fc or fd)
      if (
        ip.toLowerCase().startsWith("fc") ||
        ip.toLowerCase().startsWith("fd")
      )
        return true;

      // Link-local Address fe80::/10 (starts with fe8, fe9, fea, feb)
      const lowerIp = ip.toLowerCase();
      if (
        lowerIp.startsWith("fe8") ||
        lowerIp.startsWith("fe9") ||
        lowerIp.startsWith("fea") ||
        lowerIp.startsWith("feb")
      )
        return true;

      // IPv4-mapped IPv6 ::ffff:0:0/96
      if (lowerIp.startsWith("::ffff:")) return true;

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
