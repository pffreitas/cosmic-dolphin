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

// FxTwitter API v2 response types
interface FxTwitterAuthor {
  name?: string;
  screen_name?: string;
}

interface FxTwitterPhoto {
  type: "photo" | "gif";
  url: string;
  altText?: string;
}

interface FxTwitterVideo {
  type: "video" | "gif";
  url: string;
  thumbnail_url?: string;
}

interface FxTwitterMedia {
  photos?: FxTwitterPhoto[];
  videos?: FxTwitterVideo[];
}

interface FxTwitterStatus {
  text?: string;
  author?: FxTwitterAuthor;
  created_at?: string;
  created_timestamp?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
  media?: FxTwitterMedia;
  quote?: {
    text?: string;
    author?: FxTwitterAuthor;
  } | null;
}

interface FxTwitterResponse {
  code: number;
  status?: FxTwitterStatus | null;
  thread?: Array<FxTwitterStatus> | null;
}

interface OEmbedResponse {
  author_name?: string;
  author_url?: string;
  html?: string;
  provider_name?: string;
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
      return await this.scrapeViaFxTwitter(url);
    } catch (primaryError) {
      console.warn(
        `[TwitterService] fxTwitter failed for ${url}, trying oEmbed fallback:`,
        primaryError instanceof Error ? primaryError.message : primaryError
      );
      try {
        return await this.scrapeViaOEmbed(url);
      } catch (secondaryError) {
        console.warn(
          `[TwitterService] oEmbed failed for ${url}, trying OG fallback:`,
          secondaryError instanceof Error ? secondaryError.message : secondaryError
        );
        try {
          return await this.scrapeViaOgFallback(url);
        } catch (fallbackError) {
          throw new TwitterScrapingError(
            `Unable to scrape tweet — fxTwitter API, oEmbed, and OG fallback all failed. The tweet may be private or deleted.`,
            url,
            fallbackError
          );
        }
      }
    }
  }

  private extractStatusId(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  private async scrapeViaFxTwitter(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">> {
    const statusId = this.extractStatusId(url);
    if (!statusId) {
      throw new Error("Could not extract tweet ID from URL");
    }

    const apiUrl = `https://api.fxtwitter.com/2/${statusId}`;
    const response = await this.httpClient.fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`fxTwitter returned ${response.status}: ${response.statusText}`);
    }

    const data: FxTwitterResponse = JSON.parse(response.body);

    if (!data.status?.author?.screen_name) {
      throw new Error("fxTwitter response missing user data — tweet may be private or deleted");
    }

    const status = data.status;
    const title = `Tweet by ${status.author!.name ?? status.author!.screen_name} (@${status.author!.screen_name})`;
    const content = this.buildStructuredContent(url, data);
    const images = this.extractMedia(status);
    const links = this.extractLinks(status);

    return {
      title,
      content,
      images,
      links,
      metadata: {
        openGraph: {
          title,
          description: status.text ?? "",
          url,
          site_name: "X (formerly Twitter)",
        },
        wordCount: (status.text ?? "").split(/\s+/).filter(Boolean).length,
        readingTime: 1,
      },
    };
  }

  private buildStructuredContent(url: string, data: FxTwitterResponse): string {
    const parts: string[] = [];
    const status = data.status!;

    const authorLine = status.author?.name
      ? `${status.author.name} (@${status.author.screen_name})`
      : `@${status.author?.screen_name ?? "unknown"}`;
    const dateLine = status.created_at ? ` · ${status.created_at}` : "";
    parts.push(`${authorLine}${dateLine}`);
    parts.push("");

    parts.push(status.text ?? "");

    if (status.quote?.text) {
      const quotedAuthor = status.quote.author?.name
        ? `${status.quote.author.name} (@${status.quote.author.screen_name})`
        : `@${status.quote.author?.screen_name ?? "unknown"}`;
      parts.push("");
      parts.push(`[Quoted tweet by ${quotedAuthor}]`);
      parts.push(status.quote.text);
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
    if (typeof status.likes === "number") engagementParts.push(`${status.likes} likes`);
    if (typeof status.reposts === "number") engagementParts.push(`${status.reposts} retweets`);
    if (typeof status.replies === "number") engagementParts.push(`${status.replies} replies`);
    if (engagementParts.length > 0) {
      parts.push("");
      parts.push(`Engagement: ${engagementParts.join(" · ")}`);
    }

    parts.push("");
    parts.push(`Source: ${url}`);

    return parts.join("\n");
  }

  private extractMedia(status: FxTwitterStatus): Array<{ url: string; alt: string }> {
    const images: Array<{ url: string; alt: string }> = [];

    if (status.media?.photos) {
      for (const photo of status.media.photos) {
        images.push({
          url: photo.url,
          alt: photo.altText ?? (photo.type === "gif" ? "Tweet GIF" : "Tweet image"),
        });
      }
    }

    if (status.media?.videos) {
      for (const video of status.media.videos) {
        if (video.thumbnail_url) {
          images.push({
            url: video.thumbnail_url,
            alt: "Tweet video thumbnail",
          });
        }
      }
    }

    return images;
  }

  private extractLinks(status: FxTwitterStatus): Array<{ url: string; text: string }> {
    const links: Array<{ url: string; text: string }> = [];

    if (status.media?.videos) {
      for (const video of status.media.videos) {
        links.push({ url: video.url, text: `Tweet ${video.type}` });
      }
    }

    return links;
  }

  private async scrapeViaOEmbed(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">> {
    const statusId = this.extractStatusId(url);
    if (!statusId) {
      throw new Error("Could not extract tweet ID from URL for oEmbed");
    }

    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    const response = await this.httpClient.fetch(oEmbedUrl);

    if (!response.ok) {
      throw new Error(`oEmbed returned ${response.status}`);
    }

    const data: OEmbedResponse = JSON.parse(response.body);

    if (!data.author_name) {
      throw new Error("oEmbed response missing author data");
    }

    // Extract tweet text from the blockquote HTML
    const $ = cheerio.load(data.html ?? "");
    const tweetText = $("blockquote p").first().text().trim();
    const dateText = $("blockquote a").last().text().trim();

    const title = `Tweet by ${data.author_name}`;
    const content = [
      `${data.author_name}${dateText ? ` · ${dateText}` : ""}`,
      "",
      tweetText || "",
      "",
      `Source: ${url}`,
    ].join("\n");

    return {
      title,
      content,
      images: [],
      links: [],
      metadata: {
        openGraph: {
          title,
          description: tweetText,
          url,
          site_name: "X (formerly Twitter)",
        },
        wordCount: tweetText.split(/\s+/).filter(Boolean).length,
        readingTime: 1,
      },
    };
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
