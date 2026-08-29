import { ExploreTopic } from "@cosmic-dolphin/api-client";

/**
 * Explore's topic control, in the query string.
 *
 * The topic lives in the URL for the same reason Home's scope does: a filtered
 * Explore survives a refresh and can be sent to somebody. `all` is the default
 * and is therefore absent from the URL — a canonical `/explore` beats
 * `/explore?topic=all`, which is the same page with a longer name.
 */

/** The sentinel for "no filter". Never sent to the API. */
export const ALL_TOPICS = "all";

export interface ExploreTopicOption {
  topic: string;
  count: number;
}

/**
 * A query-string topic into a filter.
 *
 * Normalised the same way the API normalises it — trimmed and lower-cased — so
 * `?topic=AI` and `?topic=ai` are one page rather than two that disagree about
 * which segment is selected.
 */
export function parseTopic(value: string | undefined): string {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || trimmed === ALL_TOPICS) return ALL_TOPICS;
  return trimmed;
}

export function exploreHref(topic: string): string {
  return topic === ALL_TOPICS
    ? "/explore"
    : `/explore?topic=${encodeURIComponent(topic)}`;
}

export function toTopicOptions(topics: ExploreTopic[]): ExploreTopicOption[] {
  return topics.map((row) => ({ topic: row.topic, count: row.count }));
}
