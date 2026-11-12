import type { FeedItem } from "@cosmic-dolphin/api-client";
import type { Href } from "expo-router";

/** Public feed items use the shared contract; owner destinations retain owner lookup. */
export function bookmarkRoute(item: FeedItem): Href {
  const bookmark = item.bookmark!;
  return item.type === "own_save" || item.type === "pending"
    ? `/bookmark/${bookmark.id}`
    : { pathname: "/bookmark/[id]", params: { id: bookmark.id, slug: bookmark.shareSlug ?? "" } };
}
