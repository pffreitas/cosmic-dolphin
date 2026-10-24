import {
  ContentExtractionError,
  withFetchDeadline,
} from "./content-extraction";

export interface RenderedPage {
  html: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface PageExtractionProvider {
  extract(url: string): Promise<RenderedPage>;
}

/** Optional: the ordinary fetch path never incurs a provider request. */
export class FirecrawlPageProvider implements PageExtractionProvider {
  constructor(private apiKey = process.env.FIRECRAWL_API_KEY) {}

  async extract(url: string): Promise<RenderedPage> {
    if (!this.apiKey) {
      throw new ContentExtractionError(
        "Rendered extraction is not configured",
        "provider",
        false,
      );
    }
    return withFetchDeadline(45_000, async (request) => {
      const response = await request("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["html"],
          onlyMainContent: true,
          timeout: 40_000,
          storeInCache: false,
        }),
      });
      if (!response.ok) {
        throw new ContentExtractionError(
          `Rendered extraction failed (HTTP ${response.status})`,
          "provider",
          response.status === 429 || response.status >= 500,
        );
      }
      const result = (await response.json()) as {
        success?: boolean;
        data?: {
          html?: string;
          metadata?: {
            url?: string;
            sourceURL?: string;
            statusCode?: number;
            title?: string;
            description?: string;
            ogImage?: string;
          };
        };
      };
      const metadata = result.data?.metadata;
      if (!result.success || !result.data?.html?.trim()) {
        throw new ContentExtractionError(
          "Rendered extraction returned no content",
          "empty",
          true,
        );
      }
      if (metadata?.statusCode && metadata.statusCode >= 400) {
        throw new ContentExtractionError(
          `Rendered page returned HTTP ${metadata.statusCode}`,
          "blocked",
          ![401, 404, 410].includes(metadata.statusCode),
        );
      }
      return {
        html: result.data.html,
        finalUrl: metadata?.url || metadata?.sourceURL,
        title: metadata?.title,
        description: metadata?.description,
        image: metadata?.ogImage,
      };
    });
  }
}

export type TranscriptResult =
  | { status: "complete"; text: string; language?: string; provider: string }
  | { status: "pending"; jobId: string; provider: string };

export interface TranscriptProvider {
  fetchTranscript(url: string, jobId?: string): Promise<TranscriptResult>;
}

/** Managed captions with optional speech-to-text when a video has no captions. */
export class SupadataTranscriptProvider implements TranscriptProvider {
  constructor(
    private apiKey = process.env.SUPADATA_API_KEY,
    private mode = process.env.YOUTUBE_TRANSCRIPT_MODE === "native"
      ? "native"
      : "auto",
  ) {}

  async fetchTranscript(
    url: string,
    jobId?: string,
  ): Promise<TranscriptResult> {
    if (!this.apiKey) {
      throw new ContentExtractionError(
        "Managed transcripts are not configured",
        "provider",
        false,
      );
    }
    const endpoint = jobId
      ? new URL(
          `https://api.supadata.ai/v1/transcript/${encodeURIComponent(jobId)}`,
        )
      : new URL("https://api.supadata.ai/v1/transcript");
    if (!jobId) {
      endpoint.searchParams.set("url", url);
      endpoint.searchParams.set("text", "true");
      endpoint.searchParams.set("mode", this.mode);
    }
    return withFetchDeadline(30_000, async (request) => {
      const response = await request(endpoint, {
        headers: { "x-api-key": this.apiKey! },
      });
      if (!response.ok) {
        throw new ContentExtractionError(
          `Managed transcript failed (HTTP ${response.status})`,
          response.status === 404 ? "unavailable" : "provider",
          response.status === 429 || response.status >= 500,
        );
      }
      const data = (await response.json()) as {
        jobId?: string;
        status?: string;
        lang?: string;
        content?: string | Array<{ text: string }>;
      };
      if (data.status === "failed") {
        throw new ContentExtractionError(
          "Managed transcript job failed",
          "unavailable",
          false,
        );
      }
      const pendingId = data.jobId || jobId;
      if (
        pendingId &&
        (response.status === 202 ||
          ["queued", "active", "processing"].includes(data.status || "") ||
          (!data.status && data.jobId))
      ) {
        return { status: "pending", jobId: pendingId, provider: "supadata" };
      }
      const text = (
        typeof data.content === "string"
          ? data.content
          : data.content?.map((segment) => segment.text).join(" ")
      )?.trim();
      if (!text)
        throw new ContentExtractionError(
          "Managed transcript returned no text",
          "empty",
          true,
        );
      return {
        status: "complete",
        text,
        language: data.lang,
        provider: "supadata",
      };
    });
  }
}
