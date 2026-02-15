import { CheerioAPI } from "cheerio";
import {
  OpenGraphMetadata,
  BookmarkMetadata,
  ScrapedUrlContents,
} from "../types";
import * as cheerio from "cheerio";
import { HttpClient, CosmicHttpClient } from "./http-client";
import net from "node:net";

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

      const hostname = urlObj.hostname;

      // Block localhost explicitly
      if (hostname === "localhost") {
        return false;
      }

      // IPv6 addresses in URLs are bracketed, e.g., [::1]
      // net.isIP expects the address without brackets
      const cleanHostname = hostname.replace(/^\[|\]$/g, "");

      if (net.isIP(cleanHostname)) {
        let ipToCheck = cleanHostname;

        // Handle IPv4-mapped IPv6 addresses (::ffff:1.2.3.4)
        // If it starts with ::ffff: treat the rest as IPv4
        if (net.isIPv6(cleanHostname) && cleanHostname.toLowerCase().startsWith('::ffff:')) {
           ipToCheck = cleanHostname.substring(7);
           // If what remains isn't a valid IPv4, block it to be safe or just let it fall through to IPv6 checks (which won't match IPv4 format)
           // But since we stripped ::ffff:, it should look like IPv4.
           if (!net.isIPv4(ipToCheck)) {
              // Should effectively be invalid if it was a valid IPv4-mapped IPv6
              return false;
           }
        }

        // Block 0.0.0.0/8 (Current network)
        if (ipToCheck.startsWith('0.')) return false;

        // Block loopback (127.0.0.0/8)
        if (ipToCheck.startsWith("127.")) return false;

        // Block private networks
        // 10.0.0.0/8
        if (ipToCheck.startsWith("10.")) return false;
        // 192.168.0.0/16
        if (ipToCheck.startsWith("192.168.")) return false;
        // 172.16.0.0/12
        if (ipToCheck.startsWith("172.")) {
          const parts = ipToCheck.split(".");
          const secondOctet = parseInt(parts[1], 10);
          if (secondOctet >= 16 && secondOctet <= 31) return false;
        }

        // Block link-local (169.254.0.0/16)
        if (ipToCheck.startsWith("169.254.")) return false;

        // IPv6 Loopback (::1)
        if (cleanHostname === "::1" || cleanHostname === "0:0:0:0:0:0:0:1") return false;

        // IPv6 Unique Local Addresses (fc00::/7) -> fc00... to fdff...
        if (cleanHostname.toLowerCase().startsWith("fc") || cleanHostname.toLowerCase().startsWith("fd")) {
           return false;
        }

        // IPv6 Link-Local Addresses (fe80::/10)
        // fe80, fe90, fea0, feb0
        const lower = cleanHostname.toLowerCase();
        if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
           return false;
        }
      }

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
