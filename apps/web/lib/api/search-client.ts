import {
  Configuration,
  SearchApi,
  HybridSearchResponse,
  SearchAnswerSource,
  SearchDateRange,
  SearchReadStatus,
} from "@cosmic-dolphin/api-client";
import { createClient } from "@/utils/supabase/client";

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Please configure it in your environment variables."
    );
  }
  return basePath;
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || "";
}

async function getSearchApiInstance(): Promise<SearchApi> {
  const accessToken = await getAccessToken();
  return new SearchApi(
    new Configuration({
      basePath: getApiBasePath(),
      accessToken,
    })
  );
}

export interface SearchQuery {
  q: string;
  limit?: number;
  collectionId?: string;
  tag?: string;
  readStatus?: SearchReadStatus;
  dateRange?: SearchDateRange;
}

export namespace SearchClientAPI {
  /**
   * Throws rather than returning an empty list on failure.
   *
   * A swallowed error here is a search that reports "nothing matches" when the
   * truth is "the request never landed" — the same screen for two states that
   * need different words and different offers. `/search` renders its error
   * state from this throwing; the palette catches it and shows nothing.
   */
  export async function hybridSearch(
    query: SearchQuery
  ): Promise<HybridSearchResponse> {
    const searchApi = await getSearchApiInstance();
    return searchApi.searchHybridSearch({
      q: query.q,
      limit: query.limit,
      collectionId: query.collectionId,
      tag: query.tag,
      readStatus: query.readStatus,
      dateRange: query.dateRange,
    });
  }

  export interface SSECallbacks {
    onResults: (results: HybridSearchResponse["results"]) => void;
    /**
     * The bookmarks the answer will be built from. Always arrives before the
     * first chunk, and an empty array means no answer is coming — the server
     * will not write one it cannot attribute.
     */
    onSources: (sources: SearchAnswerSource[]) => void;
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }

  export async function askWithStream(
    query: string,
    callbacks: SSECallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const accessToken = await getAccessToken();
    const basePath = getApiBasePath();

    const response = await fetch(`${basePath}/search/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
      signal,
    });

    if (!response.ok) {
      callbacks.onError(`Search failed with status ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("No response stream available");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);

            switch (currentEvent) {
              case "results":
                callbacks.onResults(parsed.results);
                break;
              case "sources":
                callbacks.onSources(parsed.sources ?? []);
                break;
              case "chunk":
                callbacks.onChunk(parsed.text);
                break;
              case "done":
                callbacks.onDone();
                break;
              case "error":
                callbacks.onError(parsed.error);
                break;
            }
            currentEvent = "";
          } catch {
            // incomplete data split across reads — keep currentEvent for next iteration
          }
        }
      }
    }
  }
}
