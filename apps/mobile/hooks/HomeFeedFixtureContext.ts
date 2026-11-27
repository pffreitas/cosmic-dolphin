import { createContext } from "react";
import type { FeedItem, ContinueReadingItem, BookmarkLibraryCounts, Collection } from "@cosmic-dolphin/api-client";
/** Development gallery data only. Production never mounts this provider. */
export const HomeFeedFixtureContext = createContext<{
  items: FeedItem[]; resume: ContinueReadingItem[]; counts: BookmarkLibraryCounts; collections?: Collection[]; readerEmail?: string;
  computedAt: Date; readerName: string; loading?: boolean; now?: Date;
} | undefined>(undefined);
