import { YoutubeTranscript, TranscriptResponse } from "youtube-transcript";
import { HttpClient, CosmicHttpClient } from "./http-client";
import { OpenGraphMetadata, BookmarkMetadata, ScrapedUrlContents } from "../types";

export interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

export interface YouTubeService {
  isYouTubeUrl(url: string): boolean;
  extractVideoId(url: string): string | null;
  scrape(
    url: string
  ): Promise<
    Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  >;
}

const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
];

const YOUTUBE_HOST_REGEX = /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)$/;

export class YouTubeServiceImpl implements YouTubeService {
  constructor(private httpClient: HttpClient = new CosmicHttpClient()) {}

  isYouTubeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return YOUTUBE_HOST_REGEX.test(parsed.hostname);
    } catch {
      return false;
    }
  }

  extractVideoId(url: string): string | null {
    for (const pattern of YOUTUBE_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  }

  async scrape(
    url: string
  ): Promise<
    Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  > {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      throw new Error(`Could not extract video ID from URL: ${url}`);
    }

    const [oembedData, transcript] = await Promise.allSettled([
      this.fetchOEmbed(url),
      this.fetchTranscript(videoId),
    ]);

    const oembed =
      oembedData.status === "fulfilled" ? oembedData.value : null;
    const transcriptText =
      transcript.status === "fulfilled" ? transcript.value : null;

    if (!oembed) {
      throw new Error(`Failed to fetch YouTube video metadata for: ${url}`);
    }

    const title = oembed.title;
    const channelName = oembed.author_name;
    const thumbnailUrl = this.getHighResThumbnail(videoId, oembed.thumbnail_url);

    const openGraph: OpenGraphMetadata = {
      title,
      description: transcriptText
        ? `Video by ${channelName}`
        : `Video by ${channelName} (no transcript available)`,
      image: thumbnailUrl,
      url,
      site_name: "YouTube",
      type: "video",
      video_channel: channelName,
      video_channel_url: oembed.author_url,
      favicon: "https://www.youtube.com/favicon.ico",
    };

    const metadata: BookmarkMetadata = {
      openGraph,
      wordCount: transcriptText
        ? transcriptText.split(/\s+/).filter((w) => w.length > 0).length
        : 0,
      readingTime: transcriptText
        ? Math.ceil(
            transcriptText.split(/\s+/).filter((w) => w.length > 0).length /
              200
          )
        : 0,
    };

    const content = this.buildContentFromTranscript(
      transcriptText,
      title,
      channelName
    );

    return {
      title,
      content,
      metadata,
      images: [{ url: thumbnailUrl, alt: title }],
      links: [{ url: oembed.author_url, text: channelName }],
    };
  }

  private async fetchOEmbed(url: string): Promise<YouTubeOEmbedResponse> {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await this.httpClient.fetch(oembedUrl);

    if (!response.ok) {
      throw new Error(`oEmbed request failed with status ${response.status}`);
    }

    return JSON.parse(response.body) as YouTubeOEmbedResponse;
  }

  private async fetchTranscript(videoId: string): Promise<string> {
    const segments: TranscriptResponse[] =
      await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });

    if (!segments || segments.length === 0) {
      throw new Error(`No transcript available for video: ${videoId}`);
    }

    return segments.map((segment) => segment.text).join(" ");
  }

  private getHighResThumbnail(
    videoId: string,
    fallback: string
  ): string {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  private buildContentFromTranscript(
    transcript: string | null,
    title: string,
    channel: string
  ): string {
    const header = `YouTube Video: ${title}\nChannel: ${channel}\n\n`;

    if (transcript) {
      return `${header}Transcript:\n${transcript}`;
    }

    return `${header}No transcript available for this video.`;
  }
}
