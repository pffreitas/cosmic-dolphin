import type { PreviewResponse } from "@cosmic-dolphin/api-client";

import type { CaptureRequest } from "@/lib/store/slices/bookmarksSlice";

interface BuildPrivateLinkCaptureParams {
  url: string;
  /**
   * Optional on purpose. A private link is by definition one the fetcher may
   * not be able to read, so the preview is a bonus, never a precondition —
   * see docs/functional-spec/02-capture.md § Optimistic display. Whatever it
   * carries is used if it happens to be here by the time the user saves.
   */
  preview?: PreviewResponse | null;
  description: string;
}

/**
 * The private-link save, as a capture request.
 *
 * The user's note is the durable part: it is what makes the link findable
 * again when nothing else about the page can be read. The preview only ever
 * contributes a title, and only if it arrived.
 */
export function buildPrivateLinkCapture({
  url,
  preview,
  description,
}: BuildPrivateLinkCaptureParams): CaptureRequest {
  const title = preview?.metadata.title || undefined;

  return {
    url,
    description: description.trim(),
    isPrivateLink: true,
    ...(title ? { title } : {}),
    ...(preview ? { preview } : {}),
  };
}
