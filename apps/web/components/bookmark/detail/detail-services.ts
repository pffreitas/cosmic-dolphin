import { Highlight, ReadingProgress } from "@cosmic-dolphin/api-client";

import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { ReadingClientAPI } from "@/lib/api/reading-client";
import type { HighlightAnchor } from "@/lib/reading/highlight-anchor";

/**
 * Everything the detail page asks the network for, behind one seam.
 *
 * Not an abstraction for its own sake: `/dev/bookmark` has to render all four
 * states of this page, and four states means four sets of server answers that
 * do not exist in any one database. Injecting the calls is what lets the state
 * gallery be the real component rather than a lookalike that drifts — which is
 * the failure mode the design system's "a pattern without its states rendered
 * somewhere is not done" rule is there to prevent.
 *
 * The default is the real client, so every caller that is not the gallery
 * passes nothing.
 */
export interface DetailServices {
  markRead(id: string): Promise<{ isRead: boolean }>;
  markUnread(id: string): Promise<{ isRead: boolean }>;
  reprocess(id: string): Promise<void>;
  like(id: string): Promise<{ likeCount: number; isLiked: boolean }>;
  unlike(id: string): Promise<{ likeCount: number; isLiked: boolean }>;
  listHighlights(id: string): Promise<Highlight[]>;
  createHighlight(id: string, anchor: HighlightAnchor): Promise<Highlight>;
  getProgress(id: string): Promise<ReadingProgress | null>;
  saveProgress(
    id: string,
    percent: number,
    scrollOffset: number | null
  ): Promise<unknown>;
}

export const defaultDetailServices: DetailServices = {
  async markRead(id) {
    const updated = await BookmarksClientAPI.markRead(id);
    return { isRead: updated.isRead ?? true };
  },
  async markUnread(id) {
    const updated = await BookmarksClientAPI.markUnread(id);
    return { isRead: updated.isRead ?? false };
  },
  async reprocess(id) {
    await BookmarksClientAPI.reprocess(id);
  },
  async like(id) {
    const result = await BookmarksClientAPI.like(id);
    return { likeCount: result.likeCount, isLiked: result.isLikedByCurrentUser };
  },
  async unlike(id) {
    const result = await BookmarksClientAPI.unlike(id);
    return { likeCount: result.likeCount, isLiked: result.isLikedByCurrentUser };
  },
  listHighlights: (id) => ReadingClientAPI.listHighlights(id),
  createHighlight: (id, anchor) =>
    ReadingClientAPI.createHighlight(id, {
      quote: anchor.quote,
      prefix: anchor.prefix ?? undefined,
      suffix: anchor.suffix ?? undefined,
    }),
  getProgress: (id) => ReadingClientAPI.getProgress(id),
  saveProgress: (id, percent, scrollOffset) =>
    ReadingClientAPI.saveProgress(id, percent, scrollOffset),
};
