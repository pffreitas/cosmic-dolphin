import { CheerioAPI } from "cheerio";
import { isIP } from "node:net";
import {
  OpenGraphMetadata,
  BookmarkMetadata,
  ScrapedUrlContents,
  PreviewMetadata,
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
  extractMetadataFromUrl(url: string): PreviewMetadata;
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

      // Reject localhost
      if (hostname === "localhost") return false;

      // Remove brackets for IPv6
      const hostnameToCheck =
        hostname.startsWith("[") && hostname.endsWith("]")
          ? hostname.slice(1, -1)
          : hostname;

      // Check for IP address
      const ipType = isIP(hostnameToCheck);

      if (ipType === 4) {
        // Parse IPv4
        const parts = hostnameToCheck.split(".").map(Number);
        if (parts.length !== 4) return false;

        // 0.0.0.0/8
        if (parts[0] === 0) return false;
        // 10.0.0.0/8
        if (parts[0] === 10) return false;
        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return false;
        // 169.254.0.0/16 (Link-local)
        if (parts[0] === 169 && parts[1] === 254) return false;
        // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return false;
      } else if (ipType === 6) {
        // Loopback ::1
        if (hostnameToCheck === "::1") return false;

        // Normalize IPv6 to check prefixes
        const normalized = hostnameToCheck.toLowerCase();

        // Link-local fe80::/10
        if (normalized.startsWith("fe80:")) return false;
        // Unique local fc00::/7 (starts with fc or fd)
        if (normalized.startsWith("fc") || normalized.startsWith("fd"))
          return false;
        // IPv4-mapped ::ffff:0:0/96
        if (normalized.startsWith("::ffff:")) return false;
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

      if (response.redirectUrl) {
        this.detectAuthRedirect(url, response.redirectUrl);
      }

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

  private detectAuthRedirect(originalUrl: string, finalUrl: string): void {
    const originalHost = new URL(originalUrl).hostname;
    const finalHost = new URL(finalUrl).hostname;
    const finalPath = new URL(finalUrl).pathname.toLowerCase();

    const authPathPatterns = [
      "/login", "/signin", "/sign-in", "/sign_in",
      "/auth", "/oauth", "/sso",
      "/accounts/login", "/session/new",
      "/cas/login", "/saml",
    ];

    const ssoProviders = [
      "login.microsoftonline.com", "accounts.google.com",
      "auth0.com", "okta.com", "onelogin.com",
      "login.salesforce.com", "idp.",
    ];

    if (originalHost !== finalHost) {
      const isSsoRedirect = ssoProviders.some(
        (provider) => finalHost.includes(provider)
      );
      if (isSsoRedirect) {
        throw new Error(
          `Auth redirect detected: redirected to SSO provider ${finalHost}`
        );
      }
    }

    const isAuthPath = authPathPatterns.some((pattern) =>
      finalPath.startsWith(pattern)
    );
    if (isAuthPath) {
      throw new Error(
        `Auth redirect detected: redirected to login page ${finalUrl}`
      );
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

  extractMetadataFromUrl(url: string): PreviewMetadata {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    const siteName = hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);

    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    let title: string | undefined;
    if (pathSegments.length > 0) {
      title = pathSegments
        .map((seg) =>
          seg
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        )
        .join(" / ");
    }

    return {
      title: title || siteName,
      favicon: `${urlObj.protocol}//${urlObj.host}/favicon.ico`,
      siteName,
      url,
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
