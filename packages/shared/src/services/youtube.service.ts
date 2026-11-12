import {
  YoutubeTranscript,
  YoutubeTranscriptNotAvailableLanguageError,
} from "youtube-transcript";
import * as cheerio from "cheerio";
import { HttpClient, CosmicHttpClient } from "./http-client";
import { OpenGraphMetadata } from "../types";
import {
  ContentExtractionError,
  ExtractedContent,
  ExtractionContext,
  withFetchDeadline,
} from "./content-extraction";
import {
  BrowserExtractionProvider,
  BrowserVideoPage,
  SupadataTranscriptProvider,
  TranscriptProvider,
  TranscriptResult,
} from "./extraction-providers";

import { LightpandaPageProvider } from "./lightpanda.service";

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
  scrape(url: string, context?: ExtractionContext): Promise<ExtractedContent>;
}

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}

export class YouTubeServiceImpl implements YouTubeService {
  constructor(
    private httpClient: HttpClient = new CosmicHttpClient(),
    private transcriptProvider: TranscriptProvider | undefined = process.env
      .SUPADATA_API_KEY
      ? new SupadataTranscriptProvider()
      : undefined,
    private browserProvider: BrowserExtractionProvider = new LightpandaPageProvider(),
  ) {}

  isYouTubeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        ["https:", "http:"].includes(parsed.protocol) &&
        /^(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(
          parsed.hostname,
        )
      );
    } catch {
      return false;
    }
  }

  extractVideoId(url: string): string | null {
    if (!this.isYouTubeUrl(url)) return null;
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const candidate = /^(?:www\.)?youtu\.be$/.test(parsed.hostname)
      ? segments.length === 1
        ? segments[0]
        : null
      : parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : ["shorts", "embed", "live", "v"].includes(segments[0]) &&
            segments.length === 2
          ? segments[1]
          : null;
    return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)
      ? candidate
      : null;
  }

  async scrape(
    url: string,
    context?: ExtractionContext,
  ): Promise<ExtractedContent> {
    const videoId = this.extractVideoId(url);
    if (!videoId)
      throw new ContentExtractionError(
        `Could not extract video ID from URL: ${url}`,
        "unsupported",
        false,
      );
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    let browserRequest: Promise<BrowserVideoPage> | undefined;
    const loadBrowser = () =>
      (browserRequest ??= this.browserProvider.extractYouTube(canonicalUrl));
    const [metadataResult, transcriptResult] = await Promise.allSettled([
      this.fetchOEmbed(canonicalUrl),
      context?.metadataOnly
        ? Promise.resolve(null)
        : this.fetchTranscript(
            videoId,
            canonicalUrl,
            loadBrowser,
            context?.transcriptJobId,
          ),
    ]);
    let oembed =
      metadataResult.status === "fulfilled" ? metadataResult.value : null;
    // Reuse the browser already opened for captions; metadata-only previews
    // and resumable managed jobs never start another browser.
    if (!oembed && !context?.metadataOnly && !context?.transcriptJobId) {
      try {
        const page = await loadBrowser();
        if (page.title)
          oembed = {
            title: page.title,
            author_name: page.author || "",
            author_url: page.channelUrl || "",
            thumbnail_url: page.thumbnail || "",
            thumbnail_width: 0,
            thumbnail_height: 0,
          };
      } catch {
        /* Keep any recovered transcript even if metadata is unavailable. */
      }
    }
    const transcript =
      transcriptResult.status === "fulfilled" ? transcriptResult.value : null;
    const text =
      transcript?.status === "complete" ? transcript.text.trim() : "";
    // A metadata endpoint failing must not discard a readable transcript.
    const title = oembed?.title || `YouTube video ${videoId}`;
    const channelName = oembed?.author_name;
    const thumbnailUrl =
      oembed?.thumbnail_url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const openGraph: OpenGraphMetadata = {
      title,
      description:
        text || context?.metadataOnly
          ? channelName
            ? `Video by ${channelName}`
            : "YouTube video transcript"
          : "Video transcript could not be retrieved yet",
      image: thumbnailUrl,
      url,
      site_name: "YouTube",
      type: "video",
      video_channel: channelName,
      video_channel_url: oembed?.author_url,
      favicon: "https://www.youtube.com/favicon.ico",
    };
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const failure =
      transcriptResult.status === "rejected"
        ? transcriptResult.reason
        : undefined;
    const pendingJobId =
      transcript?.status === "pending"
        ? transcript.jobId
        : failure instanceof ContentExtractionError &&
            failure.code === "unavailable"
          ? undefined
          : context?.transcriptJobId;
    return {
      title,
      // A missing transcript is an incomplete extraction, never source text
      // for an AI summary. The bookmark service persists the card, then fails
      // the fetch phase so pgmq can retry it.
      content: text
        ? `YouTube Video: ${title}\n${channelName ? `Channel: ${channelName}\n` : ""}\nTranscript:\n${text}`
        : "",
      metadata: {
        openGraph,
        wordCount,
        readingTime: Math.ceil(wordCount / 200),
        extraction: {
          status: text
            ? "complete"
            : transcript?.status === "pending"
              ? "pending"
              : "unavailable",
          provider: transcript?.provider || "youtube",
          fetchedAt: new Date().toISOString(),
          language:
            transcript?.status === "complete" ? transcript.language : undefined,
          jobId: text ? undefined : pendingJobId,
          error: text
            ? undefined
            : failure instanceof Error
              ? failure.message
              : transcript?.status === "pending"
                ? "Video transcription is still processing"
                : "No readable transcript was returned",
          retryable:
            !text &&
            (!(failure instanceof ContentExtractionError) ||
              failure.shouldRetry),
        },
      },
      images: [{ url: thumbnailUrl, alt: title }],
      links: oembed?.author_url
        ? [{ url: oembed.author_url, text: channelName || "Channel" }]
        : [],
    };
  }

  private async fetchOEmbed(url: string): Promise<YouTubeOEmbedResponse> {
    const response = await this.httpClient.fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { timeoutMs: 8_000, retryLimit: 0 },
    );
    if (!response.ok)
      throw new Error(`oEmbed request failed with status ${response.status}`);
    const data = JSON.parse(response.body) as YouTubeOEmbedResponse;
    if (!data.title?.trim()) throw new Error("oEmbed returned no video title");
    return data;
  }

  private async fetchTranscript(
    videoId: string,
    url: string,
    loadBrowser: () => Promise<BrowserVideoPage>,
    jobId?: string,
  ): Promise<TranscriptResult> {
    // A persisted job is resumed after a restart/redelivery, never submitted
    // again and never delayed by re-running the failing native strategies.
    if (jobId && this.transcriptProvider)
      return this.transcriptProvider.fetchTranscript(url, jobId);
    const library = await this.tryFetchTranscriptViaLibrary(videoId);
    if (library) return library;
    const innerTube = await this.tryFetchTranscriptViaInnerTube(videoId);
    if (innerTube) return innerTube;
    try {
      const page = await loadBrowser();
      for (const caption of page.captions) {
        try {
          const text = this.parseTranscript(caption.body);
          if (text)
            return {
              status: "complete",
              text,
              language: caption.language,
              provider: "lightpanda",
            };
        } catch {
          /* An invalid track must not hide another caption language. */
        }
      }
    } catch (error) {
      if (error instanceof ContentExtractionError && !error.shouldRetry)
        throw error;
    }
    if (this.transcriptProvider)
      return this.transcriptProvider.fetchTranscript(url);
    throw new ContentExtractionError(
      "YouTube transcript could not be retrieved; captions may be absent or requests blocked",
      "unavailable",
      true,
    );
  }

  private async tryFetchTranscriptViaLibrary(
    videoId: string,
  ): Promise<TranscriptResult | null> {
    try {
      return await withFetchDeadline(20_000, async (boundedFetch) => {
        let segments;
        try {
          segments = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: "en",
            fetch: boundedFetch,
          });
          if (!segments?.some((segment) => segment.text?.trim())) {
            segments = await YoutubeTranscript.fetchTranscript(videoId, {
              fetch: boundedFetch,
            });
          }
        } catch (error) {
          if (!(error instanceof YoutubeTranscriptNotAvailableLanguageError))
            return null;
          segments = await YoutubeTranscript.fetchTranscript(videoId, {
            fetch: boundedFetch,
          });
        }
        const text = segments
          ?.map((segment) => this.decodeHtmlEntities(segment.text))
          .join(" ")
          .trim();
        return text
          ? {
              status: "complete",
              text,
              language: segments[0]?.lang,
              provider: "youtube-library",
            }
          : null;
      });
    } catch {
      return null;
    }
  }

  private async tryFetchTranscriptViaInnerTube(
    videoId: string,
  ): Promise<TranscriptResult | null> {
    try {
      return await withFetchDeadline(40_000, async (request, signal) => {
        const response = await request(
          "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: "MWEB",
                  clientVersion: "2.20231220.01.00",
                  hl: "en",
                  gl: "US",
                },
              },
              videoId,
            }),
          },
        );
        if (!response.ok) return null;
        const data = (await response.json()) as {
          captions?: {
            playerCaptionsTracklistRenderer?: {
              captionTracks?: CaptionTrack[];
            };
          };
        };
        const tracks =
          data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!Array.isArray(tracks)) return null;
        const score = (track: CaptionTrack) =>
          (/^en(?:-|$)/.test(track.languageCode || "") ? 0 : 2) +
          (track.kind === "asr" ? 1 : 0);
        for (const track of [...tracks]
          .sort((a, b) => score(a) - score(b))
          .slice(0, 4)) {
          if (signal.aborted) return null;
          try {
            const trackUrl = new URL(track.baseUrl || "");
            if (
              trackUrl.protocol !== "https:" ||
              !(
                trackUrl.hostname === "youtube.com" ||
                trackUrl.hostname.endsWith(".youtube.com")
              ) ||
              trackUrl.username ||
              trackUrl.password ||
              trackUrl.port
            )
              continue;
            const captionResponse = await this.httpClient.fetch(trackUrl.href, {
              timeoutMs: 8_000,
              retryLimit: 0,
              signal,
            });
            if (!captionResponse.ok) continue;
            const text = this.parseTranscript(captionResponse.body);
            if (text)
              return {
                status: "complete",
                text,
                language: track.languageCode,
                provider: "youtube-innertube",
              };
          } catch {
            // A broken/empty English track must not hide another language.
          }
        }
        return null;
      });
    } catch {
      return null;
    }
  }

  private parseTranscript(body: string): string | null {
    if (body.trimStart().startsWith("{")) {
      const data = JSON.parse(body) as {
        events?: Array<{ segs?: Array<{ utf8?: string }> }>;
      };
      return (
        data.events
          ?.map((event) =>
            event.segs?.map((segment) => segment.utf8 || "").join(""),
          )
          .filter(Boolean)
          .join(" ")
          .trim() || null
      );
    }
    const $ = cheerio.load(body, { xmlMode: true });
    if ($("html").length) return null;
    return (
      $("p[t], text[start]")
        .map((_, element) => $(element).text().trim())
        .get()
        .filter(Boolean)
        .join(" ")
        .trim() || null
    );
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, value: string) => {
        const code =
          value[0].toLowerCase() === "x"
            ? parseInt(value.slice(1), 16)
            : Number(value);
        return code <= 0x10ffff ? String.fromCodePoint(code) : match;
      });
  }
}
