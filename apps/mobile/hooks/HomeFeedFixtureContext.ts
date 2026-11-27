import { createContext } from "react";
import type { FeedItem, ContinueReadingItem, BookmarkLibraryCounts } from "@cosmic-dolphin/api-client";
/** Development gallery data only. Production never mounts this provider. */
export const HomeFeedFixtureContext = createContext<{
  items: FeedItem[]; resume: ContinueReadingItem[]; counts: BookmarkLibraryCounts;
  computedAt: Date; readerName: string; loading?: boolean; now?: Date;
} | undefined>(undefined);
