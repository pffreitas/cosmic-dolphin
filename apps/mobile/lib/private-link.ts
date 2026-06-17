import type { CreateBookmarkParams, PreviewUrlResponse } from './api';

interface BuildPrivateLinkCreateParamsInput {
  url: string;
  preview: PreviewUrlResponse;
  description: string;
}

export function isPrivateLinkPreview(
  preview: PreviewUrlResponse | null
): preview is PreviewUrlResponse & { scrapable: false } {
  return preview?.scrapable === false;
}

export function buildPrivateLinkCreateParams({
  url,
  preview,
  description,
}: BuildPrivateLinkCreateParamsInput): CreateBookmarkParams {
  return {
    source_url: url,
    title: preview.metadata.title,
    description: description.trim(),
    is_private_link: true,
  };
}
