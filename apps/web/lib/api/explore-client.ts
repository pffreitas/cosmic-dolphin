import { ExploreApi, ExploreResponse } from "@cosmic-dolphin/api-client";

import { getConfiguration } from "@/lib/api/bookmarks-client";

/**
 * Explore's next page, from the browser.
 *
 * The failure is **kept**, for the same reason `FeedClientAPI.page` keeps its
 * own: an empty page and a failed request are indistinguishable to the caller,
 * and one of the two needs to put a **Retry** in front of the reader instead of
 * quietly ending the scroll.
 */
export namespace ExploreClientAPI {
  export async function page(query: {
    topic?: string;
    cursor: string;
    limit?: number;
  }): Promise<ExploreResponse> {
    return await new ExploreApi(await getConfiguration()).exploreList(query);
  }
}
