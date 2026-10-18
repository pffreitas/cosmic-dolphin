import type { Digest, FeedItem } from "@cosmic-dolphin/api-client";
import { nativeBookmark } from "./mobile-api";
import type { Bookmark } from "./api";
export type Edition = {
  id: string;
  title: string;
  topic: string;
  description: string;
  bookmarks: Bookmark[];
  digest?: Digest;
};
export function topicName(tag: string) {
  if (
    /^(ai|artificial intelligence|machine learning|llms?|generative ai)$/i.test(
      tag.trim(),
    )
  )
    return "AI";
  if (
    /^(self[- ]improvement|personal (growth|development)|habits|productivity)$/i.test(
      tag.trim(),
    )
  )
    return "Self improvement";
  return tag.trim().replace(/^\w/, (c) => c.toUpperCase());
}
/** Topics come from pipeline tags, and prose only from server-authored digests. */
export function buildEditions(
  items: FeedItem[],
  interests: string[] = [],
): Edition[] {
  const unique = new Map<string, Bookmark>();
  for (const item of items)
    if (item.bookmark)
      unique.set(item.bookmark.id, nativeBookmark(item.bookmark));
  const groups = new Map<string, Bookmark[]>();
  for (const bookmark of unique.values()) {
    const topics = new Set(
      (bookmark.cosmicTags ?? []).map(topicName).filter(Boolean),
    );
    for (const topic of topics)
      groups.set(topic, [...(groups.get(topic) ?? []), bookmark]);
  }
  const editions: Edition[] = [
    ...new Map(
      items
        .filter((item) => item.digest)
        .map((item) => [item.digest!.id, item]),
    ).values(),
  ].map((item) => {
    const digest = item.digest!;
    return {
      id: `digest:${digest.id}`,
      title: digest.title,
      topic: "Across your saves",
      description: digest.summary,
      digest,
      bookmarks: digest.sources.flatMap((source) =>
        unique.has(source.bookmarkId) ? [unique.get(source.bookmarkId)!] : [],
      ),
    };
  });
  for (const [topic, bookmarks] of groups) {
    editions.push({
      id: `topic:${topic}`,
      topic,
      title: topic === "AI" ? "Latest on AI" : topic,
      description:
        topic === "AI"
          ? "Ideas, tools and research to spend some time with."
          : topic === "Self improvement"
            ? "Small shifts for better focus, learning and everyday life."
            : `A reading list around ${topic.toLowerCase()}.`,
      bookmarks:
        topic === "AI"
          ? [...bookmarks].sort(
              (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
            )
          : bookmarks,
    });
  }
  if (!editions.length && unique.size)
    editions.push({
      id: "for-you",
      title: "Worth your time",
      topic: "For you",
      description: "A few links to explore next.",
      bookmarks: [...unique.values()],
    });
  return editions.sort((a, b) => {
    const score = (edition: Edition) =>
      interests.includes(edition.topic) ? 2 : edition.digest ? 1 : 0;
    return score(b) - score(a);
  });
}
