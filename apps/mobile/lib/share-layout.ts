const FOOTER_SCROLL_PADDING = 196;

export function getShareScrollBottomInset(safeAreaBottom: number): number {
  return safeAreaBottom + FOOTER_SCROLL_PADDING;
}

export function shouldRenderPreviewMedia(
  isPrivateLink: boolean,
  hasImage: boolean
): boolean {
  return hasImage || !isPrivateLink;
}
