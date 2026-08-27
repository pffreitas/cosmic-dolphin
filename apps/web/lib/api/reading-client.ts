import {
  ReadingApi,
  ContinueReadingItem,
  Highlight,
  SaveReadingProgressResponse,
} from "@cosmic-dolphin/api-client";
import { getConfiguration } from "@/lib/api/bookmarks-client";

/**
 * Reading progress and highlights, for the reader D10 builds.
 *
 * The throttle is not here — it is in `lib/reading/progress.ts`, because
 * throttling is a property of the caller's cadence and not of the transport.
 * This file is only the wire.
 *
 * Progress failures are swallowed and highlight failures are not, which is the
 * one editorial decision in the file: progress is bookkeeping the reader never
 * asked for and a newer value is a scroll away, while a highlight is something
 * a person did on purpose and a silent failure would be a lie about it.
 */
export namespace ReadingClientAPI {
  async function api(): Promise<ReadingApi> {
    return new ReadingApi(await getConfiguration());
  }

  /**
   * Returns `null` when the write could not be made. Never throws: a dropped
   * progress write must not interrupt reading.
   */
  export async function saveProgress(
    bookmarkId: string,
    percent: number,
    scrollOffset: number | null
  ): Promise<SaveReadingProgressResponse | null> {
    try {
      return await (
        await api()
      ).readingSaveProgress({
        id: bookmarkId,
        saveReadingProgressRequest: { percent, scrollOffset },
      });
    } catch (error) {
      console.error("Error saving reading progress", error);
      return null;
    }
  }

  export async function continueReading(
    limit?: number
  ): Promise<ContinueReadingItem[]> {
    try {
      const response = await (await api()).readingContinueReading({ limit });
      return response.items ?? [];
    } catch (error) {
      console.error("Error fetching continue reading", error);
      return [];
    }
  }

  export async function listHighlights(
    bookmarkId: string
  ): Promise<Highlight[]> {
    try {
      const response = await (
        await api()
      ).readingListHighlights({ id: bookmarkId });
      return response.highlights ?? [];
    } catch (error) {
      console.error("Error fetching highlights", error);
      return [];
    }
  }

  export async function createHighlight(
    bookmarkId: string,
    highlight: { quote: string; prefix?: string; suffix?: string; note?: string }
  ): Promise<Highlight> {
    return await (
      await api()
    ).readingCreateHighlight({
      id: bookmarkId,
      createHighlightRequest: highlight,
    });
  }

  export async function updateHighlightNote(
    id: string,
    note: string | null
  ): Promise<Highlight> {
    return await (
      await api()
    ).highlightsUpdate({ id, updateHighlightRequest: { note } });
  }

  export async function deleteHighlight(id: string): Promise<void> {
    await (await api()).highlightsRemove({ id });
  }
}
