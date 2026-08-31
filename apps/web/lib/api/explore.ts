import {
  Configuration,
  ExploreApi,
  ExploreRailResponse,
  ExploreResponse,
} from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/server";

/**
 * Explore, server side.
 *
 * The page and the rail fail differently on purpose, exactly as Home's do:
 *
 *  - **The page keeps its failure.** `null` means the request did not
 *    complete, which is a different thing from "nobody has published anything
 *    yet", and Explore's whole empty state depends on telling those two apart.
 *    An honest empty state that fires on a network error is a lie about the
 *    product.
 *  - **The rail swallows its failure.** It is a column of shortcuts that is
 *    not rendered at all below 900px; a **Retry** on it would be asking the
 *    reader to care about our plumbing.
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

export const EMPTY_EXPLORE_RAIL: ExploreRailResponse = {
  collections: [],
  people: [],
};

export namespace ExploreAPI {
  /** A page of discovery, plus the topic control's options. `null` on failure. */
  export async function list(query?: {
    topic?: string;
    limit?: number;
  }): Promise<ExploreResponse | null> {
    try {
      return await new ExploreApi(await configuration()).exploreList(query ?? {});
    } catch (error) {
      console.error("Error fetching explore", error);
      return null;
    }
  }

  export async function rail(): Promise<ExploreRailResponse> {
    try {
      return await new ExploreApi(await configuration()).exploreRail({});
    } catch (error) {
      console.error("Error fetching explore rail", error);
      return EMPTY_EXPLORE_RAIL;
    }
  }
}
