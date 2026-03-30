import { HttpClient } from "./http-client";
import { ScrapedUrlContents } from "../types";

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
      const urlObj = new URL(url);
      return (
        urlObj.hostname === "twitter.com" ||
        urlObj.hostname === "x.com" ||
        urlObj.hostname === "www.twitter.com" ||
        urlObj.hostname === "www.x.com"
      );
    } catch {
      return false;
    }
  }

  async scrape(
    url: string
  ): Promise<Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">> {
    const urlObj = new URL(url);
    // Replace x.com or twitter.com with api.vxtwitter.com
    urlObj.hostname = "api.vxtwitter.com";

    const response = await this.httpClient.fetch(urlObj.toString());
    const data = JSON.parse(response.body);

    const title = `Tweet by ${data.user_name} (@${data.user_screen_name})`;
    const content = data.text || "";

    const images = (data.media_extended || [])
      .filter((m: any) => m.type === "image")
      .map((m: any) => ({
        url: m.url,
        alt: "Tweet media",
      }));

    return {
      title,
      content,
      images,
      links: [],
      metadata: {
        openGraph: {
          title,
          description: content,
          url,
          site_name: "X (formerly Twitter)",
        },
        wordCount: content.split(/\s+/).length,
        readingTime: Math.ceil(content.split(/\s+/).length / 200) || 1,
      },
    };
  }
}
