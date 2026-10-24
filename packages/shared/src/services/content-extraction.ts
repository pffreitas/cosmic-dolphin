import { ScrapedUrlContents } from "../types";

export type ExtractedContent = Omit<
  ScrapedUrlContents,
  "id" | "createdAt" | "updatedAt" | "bookmarkId"
>;

export interface ExtractionContext {
  transcriptJobId?: string;
  /** URL-card previews must not start paid rendering or transcription jobs. */
  metadataOnly?: boolean;
}

/** Failures the queue can recover from must retain their classification. */
export class ContentExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "blocked"
      | "empty"
      | "auth"
      | "unsupported"
      | "unavailable"
      | "pending"
      | "provider",
    public readonly shouldRetry: boolean,
  ) {
    super(message);
    this.name = "ContentExtractionError";
  }
}

export function isIncompleteExtraction(content: ExtractedContent): boolean {
  const status = content.metadata?.extraction?.status;
  if (status) return status !== "complete";
  // Recover rows written before extraction status was recorded. A placeholder
  // must never be treated as the video's source material on later retries.
  return (
    content.metadata?.openGraph?.site_name === "YouTube" &&
    (content.metadata.wordCount === 0 ||
      !content.content?.trim() ||
      /No transcript available for this video\./i.test(content.content))
  );
}

/** A single budget shared by every fetch made by a transcript library call. */
export async function withFetchDeadline<T>(
  timeoutMs: number,
  work: (boundedFetch: typeof fetch, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const boundedFetch: typeof fetch = (input, init) =>
      fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([controller.signal, init.signal])
          : controller.signal,
      });
    return await work(boundedFetch, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ContentExtractionError(
        "Content extraction request timed out",
        "provider",
        true,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
