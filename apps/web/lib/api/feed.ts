import {
  Configuration,
  ContinueReadingItem,
  FeedApi,
  FeedRailResponse,
  ReadingApi,
} from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/server";

/**
 * Home's rail, server side.
 *
 * Both reads return an empty shape on failure rather than throwing, and that
 * is a deliberate difference from `BookmarksAPI.listPage`, which keeps its
 * error so the Library can offer **Retry**. The rail is not load-bearing:
 * below 900px it is not rendered at all and nothing in it is unique
 * (docs/design-system/pages.md § Home). A failure here is a dimmed column, and
 * a **Retry** button on a column the reader could lose entirely without
 * noticing would be asking them to care about our plumbing.
 */

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables."
    );
  }
  return basePath;
}

async function configuration(): Promise<Configuration> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return new Configuration({
    basePath: getApiBasePath(),
    accessToken: session?.access_token || "",
  });
}

export const EMPTY_RAIL: FeedRailResponse = { topics: [], people: [] };

export namespace FeedAPI {
  /** Topics this week and the people the reader follows, in one request. */
  export async function rail(): Promise<FeedRailResponse> {
    try {
      return await new FeedApi(await configuration()).feedRail({});
    } catch (error) {
      console.error("Error fetching feed rail", error);
      return EMPTY_RAIL;
    }
  }

  /**
   * Continue reading — D8's route, not a second definition of "part-way
   * through". Three is what the rail shows.
   */
  export async function continueReading(
    limit = 3
  ): Promise<ContinueReadingItem[]> {
    try {
      const response = await new ReadingApi(
        await configuration()
      ).readingContinueReading({ limit });
      return response.items ?? [];
    } catch (error) {
      console.error("Error fetching continue reading", error);
      return [];
    }
  }
}
