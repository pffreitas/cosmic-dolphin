import {
  Configuration,
  SearchApi,
  HybridSearchResponse,
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

export namespace SearchClientAPI {
  export async function hybridSearch(
    query: string,
    limit?: number
  ): Promise<HybridSearchResponse> {
    const searchApi = await getSearchApiInstance();
    try {
      return await searchApi.searchHybridSearch({ q: query, limit });
    } catch (error) {
      console.error("Error performing hybrid search", error);
      return { results: [] };
    }
  }

  export interface SSECallbacks {
    onResults: (results: HybridSearchResponse["results"]) => void;
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }

  export async function askWithStream(
    query: string,
    callbacks: SSECallbacks
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
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
          } catch {
            // skip malformed data
          }
          currentEvent = "";
        }
      }
    }
  }
}
