import { Bookmark } from "@cosmic-dolphin/api-client";

import { libraryHref } from "./params";

/**
 * A library row, ready to render.
 *
 * Built on the server so the relative time is computed once, in one clock,
 * rather than on the server and then again during hydration — where a save
 * made 59 seconds ago is "just now" in one render and "1m ago" in the next,
 * and React reports it as a mismatch.
 */
export interface LibraryItem {
  id: string;
  href: string;
  title: string;
  summary?: string;
  collectionId: string | null;
  collectionPath: { id: string; name: string; href: string }[];
  filing: boolean;
  unread: boolean;
  tags: string[];
  domain?: string;
  savedAt: string;
  readingTime?: string;
  thumbnailUrl?: string;
  privateLink: boolean;
  summaryLoading: boolean;
  archived: boolean;
}

export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;

/** "just now", "4m ago", "2d ago", "3w ago", "1y ago". */
export function formatSavedAt(value: Date | string, now: Date = new Date()): string {
  const then = value instanceof Date ? value : new Date(value);
  const elapsed = now.getTime() - then.getTime();

  if (Number.isNaN(elapsed)) return "";
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  if (elapsed < YEAR) return `${Math.floor(elapsed / WEEK)}w ago`;
  return `${Math.floor(elapsed / YEAR)}y ago`;
}

export function toLibraryItem(
  bookmark: Bookmark,
  now: Date = new Date()
): LibraryItem {
  const readingMinutes = bookmark.metadata?.readingTime;
  const processing = bookmark.processingStatus === "processing";

  return {
    id: bookmark.id,
    href: `/bookmarks/${bookmark.id}`,
    title: bookmark.title?.trim() || "Untitled",
    summary:
      bookmark.cosmicBriefSummary ||
      bookmark.metadata?.openGraph?.description ||
      undefined,
    collectionId: bookmark.collectionId ?? null,
    collectionPath: (bookmark.collectionPath ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      href: libraryHref({ collectionId: item.id }),
    })),
    // The `file` phase is still in flight: the row reads Inbox with a *filing…*
    // marker, which is a suggestion in progress and not a move that happened.
    filing: processing && !bookmark.collectionId,
    unread: !(bookmark.isRead ?? Boolean(bookmark.readAt)),
    tags: bookmark.cosmicTags ?? [],
    domain: extractDomain(bookmark.sourceUrl ?? ""),
    savedAt: formatSavedAt(bookmark.createdAt, now),
    readingTime: readingMinutes ? `${readingMinutes} min` : undefined,
    thumbnailUrl: bookmark.metadata?.openGraph?.image || undefined,
    privateLink: Boolean(bookmark.isPrivateLink),
    summaryLoading:
      processing &&
      !bookmark.cosmicBriefSummary &&
      !bookmark.metadata?.openGraph?.description,
    archived: Boolean(bookmark.isArchived),
  };
}
