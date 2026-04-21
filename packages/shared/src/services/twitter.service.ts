import * as cheerio from "cheerio";
import { HttpClient } from "./http-client";
import { ScrapedUrlContents } from "../types";

export class TwitterScrapingError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "TwitterScrapingError";
  }
}

interface VxTwitterMedia {
  type: "image" | "video" | "gif";
  url: string;
  thumbnail_url?: string;
  altText?: string;
}

interface VxTwitterQuote {
  text?: string;
  user_name?: string;
  user_screen_name?: string;
}

interface VxTwitterResponse {
  text?: string;
  user_name?: string;
  user_screen_name?: string;
  date?: string;
  date_epoch?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  media_extended?: VxTwitterMedia[];
  qrt?: VxTwitterQuote;
  thread?: Array<{ text?: string }>;
}

export interface TwitterService {
  isTwitterUrl(url: string): boolean;
  scrape(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">>;
}

export class TwitterServiceImpl implements TwitterService {
  constructor(private httpClient: HttpClient) {}

  isTwitterUrl(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return (
        hostname === "twitter.com" ||
        hostname === "x.com" ||
        hostname === "www.twitter.com" ||
        hostname === "www.x.com"
      );
    } catch {
      return false;
    }
  }

  async scrape(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">> {
    try {
      return await this.scrapeViaVxTwitter(url);
    } catch (primaryError) {
      console.warn(
        `[TwitterService] vxTwitter failed for ${url}, trying OG fallback:`,
        primaryError instanceof Error ? primaryError.message : primaryError
      );
      try {
        return await this.scrapeViaOgFallback(url);
      } catch (fallbackError) {
        throw new TwitterScrapingError(
          `Unable to scrape tweet — vxTwitter API and OG fallback both failed. The tweet may be private or deleted.`,
          url,
          fallbackError
        );
      }
    }
  }

  private async scrapeViaVxTwitter(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">> {
    const apiUrl = new URL(url);
    apiUrl.hostname = "api.vxtwitter.com";

    const response = await this.httpClient.fetch(apiUrl.toString());

    if (!response.ok) {
      throw new Error(`vxTwitter returned ${response.status}: ${response.statusText}`);
    }

    const data: VxTwitterResponse = JSON.parse(response.body);

    if (!data.user_screen_name) {
      throw new Error("vxTwitter response missing user data — tweet may be private or deleted");
    }

    const title = `Tweet by ${data.user_name ?? data.user_screen_name} (@${data.user_screen_name})`;
    const content = this.buildStructuredContent(url, data);
    const images = this.extractMedia(data);
    const links = this.extractLinks(data);

    return {
      title,
      content,
      images,
      links,
      metadata: {
        openGraph: {
          title,
          description: data.text ?? "",
          url,
          site_name: "X (formerly Twitter)",
        },
        wordCount: (data.text ?? "").split(/\s+/).filter(Boolean).length,
        readingTime: 1,
      },
    };
  }

  private buildStructuredContent(url: string, data: VxTwitterResponse): string {
    const parts: string[] = [];

    const authorLine = data.user_name
      ? `${data.user_name} (@${data.user_screen_name})`
      : `@${data.user_screen_name}`;
    const dateLine = data.date ? ` · ${data.date}` : "";
    parts.push(`${authorLine}${dateLine}`);
    parts.push("");

    parts.push(data.text ?? "");

    if (data.qrt?.text) {
      const quotedAuthor = data.qrt.user_name
        ? `${data.qrt.user_name} (@${data.qrt.user_screen_name})`
        : `@${data.qrt.user_screen_name ?? "unknown"}`;
      parts.push("");
      parts.push(`[Quoted tweet by ${quotedAuthor}]`);
      parts.push(data.qrt.text);
    }

    if (data.thread && data.thread.length > 0) {
      parts.push("");
      parts.push("[Thread continues]");
      for (const threadTweet of data.thread) {
        if (threadTweet.text) {
          parts.push(threadTweet.text);
        }
      }
    }

    const engagementParts: string[] = [];
    if (typeof data.likes === "number") engagementParts.push(`${data.likes} likes`);
    if (typeof data.retweets === "number") engagementParts.push(`${data.retweets} retweets`);
    if (typeof data.replies === "number") engagementParts.push(`${data.replies} replies`);
    if (engagementParts.length > 0) {
      parts.push("");
      parts.push(`Engagement: ${engagementParts.join(" · ")}`);
    }

    parts.push("");
    parts.push(`Source: ${url}`);

    return parts.join("\n");
  }

  private extractMedia(
    data: VxTwitterResponse
  ): Array<{ url: string; alt: string }> {
    if (!data.media_extended) return [];

    const images: Array<{ url: string; alt: string }> = [];

    for (const media of data.media_extended) {
      if (media.type === "image") {
        images.push({ url: media.url, alt: media.altText ?? "Tweet image" });
      } else if (media.type === "video" || media.type === "gif") {
        // Use thumbnail as a representative image; store video URL as a link
        if (media.thumbnail_url) {
          images.push({
            url: media.thumbnail_url,
            alt: media.type === "gif" ? "Tweet GIF thumbnail" : "Tweet video thumbnail",
          });
        }
      }
    }

    return images;
  }

  private extractLinks(
    data: VxTwitterResponse
  ): Array<{ url: string; text: string }> {
    const links: Array<{ url: string; text: string }> = [];

    if (!data.media_extended) return links;

    for (const media of data.media_extended) {
      if (media.type === "video" || media.type === "gif") {
        links.push({ url: media.url, text: `Tweet ${media.type}` });
      }
    }

    return links;
  }

  private async scrapeViaOgFallback(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">> {
    const response = await this.httpClient.fetch(url);

    if (!response.ok) {
      throw new Error(`OG fetch returned ${response.status}`);
    }

    const $ = cheerio.load(response.body);

    const ogTitle =
      $('meta[property="og:title"]').attr("content") ??
      $("title").first().text().trim() ??
      "Tweet";
    const ogDescription =
      $('meta[property="og:description"]').attr("content") ?? "";
    const ogImage = $('meta[property="og:image"]').attr("content");

    const images = ogImage ? [{ url: ogImage, alt: "Tweet preview" }] : [];

    return {
      title: ogTitle,
      content: [ogTitle, "", ogDescription, "", `Source: ${url}`].join("\n"),
      images,
      links: [],
      metadata: {
        openGraph: {
          title: ogTitle,
          description: ogDescription,
          image: ogImage,
          url,
          site_name: "X (formerly Twitter)",
        },
        wordCount: ogDescription.split(/\s+/).filter(Boolean).length,
        readingTime: 1,
      },
    };
  }
}
