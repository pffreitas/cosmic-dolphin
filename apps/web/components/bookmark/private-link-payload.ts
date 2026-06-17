import type {
  CreateBookmarkRequest,
  PreviewResponse,
} from "@cosmic-dolphin/api-client";

interface BuildPrivateLinkCreateRequestParams {
  url: string;
  previewData: PreviewResponse;
  description: string;
}

export function buildPrivateLinkCreateRequest({
  url,
  previewData,
  description,
}: BuildPrivateLinkCreateRequestParams): CreateBookmarkRequest {
  return {
    sourceUrl: url,
    title: previewData.metadata.title || undefined,
    description: description.trim(),
    isPrivateLink: true,
  };
}
