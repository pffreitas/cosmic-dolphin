import {
  Bookmark,
  Digest,
  FeedItem as ApiFeedItem,
  FeedScope,
} from "@cosmic-dolphin/api-client";

import { shareUrlForSlug } from "@/components/bookmark/detail/detail-data";
import { extractDomain, formatSavedAt } from "@/components/bookmark/library/row-data";
import type { ProcessingStep } from "@/components/ai/processing-steps";
import type { DigestSourceLink, FeedItemVariant } from "./feed-item";

/**
 * A feed row, ready to render — the Home analogue of `library/row-data.ts`.
 *
 * Everything time-shaped is formatted **here**, on the server, for the same
 * reason the Library does it: a save made 59 seconds ago is "just now" in the
 * server render and "1m ago" in the first client render, and React answers a
 * text mismatch by abandoning hydration — which leaves a page that screenshots
 * perfectly and whose every button is dead.
 *
 * Nothing in this file invents a reason. `rankingReason` is carried through
 * verbatim from the API or it is absent; the client cannot know what the
 * ranker weighted, and a plausible-sounding wrong answer is worse than none
 * (docs/functional-spec/05-feed.md § Why this appeared).
 */

/** The stable identity of a row, across both arms of the union. */
export type FeedEntryKey = string;

export interface FeedEntryBase {
  /** `${type}:${id}` — unique across bookmarks and digests alike. */
  key: FeedEntryKey;
  variant: FeedItemVariant;
  href: string;
  title: string;
  summary?: string;
  rankingReason?: string;
}

export interface FeedBookmarkEntry extends FeedEntryBase {
  kind: "bookmark";
  variant: Exclude<FeedItemVariant, "digest">;
  bookmarkId: string;
  /** Bare host. The **Fewer from this domain** action's whole payload. */
  domain?: string;
  faviconUrl?: string | null;
  /** Who it reached the reader through. Absent on the reader's own saves. */
  actor?: {
    name: string;
    handle: string;
    avatarUrl?: string | null;
    href: string;
  };
  /** "shared", "reshared", "you saved this". */
  action: string;
  /** Already formatted: "2d ago". */
  savedAt: string;
  tags: string[];
  /** The **Mute topic** action's payload — the first tag, or nothing. */
  muteTopic?: string;
  readingTime?: string;
  thumbnailUrl?: string;
  duration?: string;
  privateLink: boolean;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  shareUrl?: string;
  /** Already in the reader's library: their own save, or one they reshared. */
  saved: boolean;
  /** The reader's own save. Reshare is not offered on it. */
  own: boolean;
  /**
   * Staged pipeline progress, derived from what the row actually carries.
   *
   * Empty when there is nothing to report. Never a fake percentage and never a
   * phase claimed done on a guess — every line below is read off a field that
   * either has a value or does not (docs/design-system/README.md, rule 7).
   */
  steps: ProcessingStep[];
}

export interface FeedDigestEntry extends FeedEntryBase {
  kind: "digest";
  variant: "digest";
  digestId: string;
  keyPoints: { term?: string; text: string }[];
  sources: DigestSourceLink[];
  likeCount: number;
  liked: boolean;
  shareUrl?: string;
}

export type FeedEntry = FeedBookmarkEntry | FeedDigestEntry;

/** YouTube and Vimeo get the video variant; everything else reads. */
const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];

function isVideo(domain: string | undefined): boolean {
  if (!domain) return false;
  return VIDEO_HOSTS.some(
    (host) => domain === host || domain.endsWith(`.${host}`)
  );
}

function actorName(actor: NonNullable<ApiFeedItem["actor"]>): string {
  return actor.name?.trim() || (actor.handle ? `@${actor.handle}` : "Someone");
}

/**
 * What happened, in the product's words.
 *
 * `reshare` says "reshared" rather than "shared" because the two are different
 * events and the provenance row is the one place the difference is visible: a
 * reshare is a save of somebody else's save, and collapsing it into "shared"
 * would quietly erase a hop in the chain.
 */
function actionFor(type: ApiFeedItem["type"]): string {
  switch (type) {
    case "followed_save":
      return "shared";
    case "reshare":
      return "reshared";
    default:
      return "you saved this";
  }
}

/**
 * The pipeline's state, read off the bookmark rather than narrated.
 *
 * Each line corresponds to a field that is either populated or not, so nothing
 * here can claim a phase finished that did not. A completed bookmark produces
 * no steps at all: a checklist of four ticks under a finished article is noise
 * pretending to be progress.
 */
export function pipelineSteps(bookmark: Bookmark): ProcessingStep[] {
  const processing = bookmark.processingStatus === "processing";
  const failed = bookmark.processingStatus === "failed";

  if (!processing && !failed) return [];

  if (failed) {
    return [
      {
        phase: "summarise",
        state: "failed",
        error: bookmark.processingError || "The run stopped part-way.",
      },
    ];
  }

  const hasSummary = Boolean(bookmark.cosmicBriefSummary);
  const hasTags = (bookmark.cosmicTags ?? []).length > 0;
  const filed = Boolean(bookmark.collectionId);

  return [
    { phase: "extract", state: "done" },
    { phase: "summarise", state: hasSummary ? "done" : "active" },
    {
      phase: "tag",
      state: hasTags ? "done" : hasSummary ? "active" : "pending",
    },
    { phase: "file", state: filed ? "done" : "pending" },
  ];
}

export function toBookmarkEntry(
  item: ApiFeedItem & { bookmark: Bookmark },
  now: Date = new Date()
): FeedBookmarkEntry {
  const bookmark = item.bookmark;
  const domain = extractDomain(bookmark.sourceUrl ?? "");
  const processing = bookmark.processingStatus === "processing";
  const readingMinutes = bookmark.metadata?.readingTime;
  const tags = bookmark.cosmicTags ?? [];

  return {
    kind: "bookmark",
    key: `bookmark:${bookmark.id}`,
    // `pending` is pinned rather than ranked and its whole variant is the
    // staged progress; anything else with a video host reads as a video.
    variant:
      item.type === "pending" || processing
        ? "pending"
        : isVideo(domain)
          ? "video"
          : "article",
    bookmarkId: bookmark.id,
    href: `/bookmarks/${bookmark.id}`,
    title: bookmark.title?.trim() || "Untitled",
    summary:
      bookmark.cosmicBriefSummary ||
      bookmark.metadata?.openGraph?.description ||
      undefined,
    rankingReason: item.rankingReason,
    domain,
    faviconUrl: bookmark.metadata?.openGraph?.favicon ?? undefined,
    actor: item.actor
      ? {
          name: actorName(item.actor),
          handle: item.actor.handle,
          avatarUrl: item.actor.pictureUrl ?? undefined,
          href: `/u/${item.actor.handle}`,
        }
      : undefined,
    action: actionFor(item.type),
    savedAt: formatSavedAt(bookmark.createdAt, now),
    tags,
    // One topic, not a submenu of six. The menu item says "Mute topic" in the
    // singular and the first tag is the ranker's own leading one — offering
    // every tag would turn a one-press correction into a decision.
    muteTopic: tags[0],
    readingTime: readingMinutes ? `${readingMinutes} min` : undefined,
    thumbnailUrl: bookmark.metadata?.openGraph?.image || undefined,
    privateLink: Boolean(bookmark.isPrivateLink),
    likeCount: bookmark.likeCount ?? 0,
    liked: Boolean(bookmark.isLikedByCurrentUser),
    commentCount: bookmark.commentCount ?? 0,
    shareUrl: bookmark.shareSlug ? shareUrlForSlug(bookmark.shareSlug) : undefined,
    // The reader's own saves are already in the library, which is what the
    // Save control would put them in. `saveOnce` then keeps it honest.
    saved: item.type === "own_save" || item.type === "pending",
    own: item.type === "own_save" || item.type === "pending",
    steps: pipelineSteps(bookmark),
  };
}

export function toDigestEntry(
  item: ApiFeedItem & { digest: Digest }
): FeedDigestEntry {
  const digest = item.digest;

  return {
    kind: "digest",
    key: `digest:${digest.id}`,
    variant: "digest",
    digestId: digest.id,
    href: `/digests/${digest.id}`,
    title: digest.title,
    summary: digest.summary,
    rankingReason: item.rankingReason,
    keyPoints: (digest.keyPoints ?? []).map((point) => ({
      term: point.term,
      text: point.text,
    })),
    // Whole and in order. A digest that cannot name what it was built from is
    // a digest that does not render — the variant takes the complete list and
    // decides for itself where to tail it.
    sources: (digest.sources ?? []).map((source) => ({
      bookmarkId: source.bookmarkId,
      domain: source.domain,
      href: `/bookmarks/${source.bookmarkId}`,
      faviconUrl: source.faviconUrl ?? undefined,
    })),
    likeCount: digest.likeCount ?? 0,
    liked: Boolean(digest.isLikedByCurrentUser),
    shareUrl: digest.shareUrl,
  };
}

/**
 * A page of API items into rows.
 *
 * An item with neither a bookmark nor a digest is dropped rather than rendered
 * empty: the contract says one of the two is always present, and a row with no
 * subject is a bug somewhere upstream that the reader should not have to look
 * at while it is found.
 */
export function toFeedEntries(
  items: ApiFeedItem[],
  now: Date = new Date()
): FeedEntry[] {
  const entries: FeedEntry[] = [];

  for (const item of items) {
    if (item.type === "digest" && item.digest) {
      entries.push(toDigestEntry(item as ApiFeedItem & { digest: Digest }));
      continue;
    }
    if (item.bookmark) {
      entries.push(
        toBookmarkEntry(item as ApiFeedItem & { bookmark: Bookmark }, now)
      );
    }
  }

  return entries;
}

/** Drop rows already on screen — the belt to the cursor's braces. */
export function dedupeEntries(entries: FeedEntry[]): FeedEntry[] {
  const seen = new Set<FeedEntryKey>();
  return entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// The scope control and its meta line
// ---------------------------------------------------------------------------

export const FEED_SCOPES: { value: FeedScope; label: string }[] = [
  { value: FeedScope.ForYou, label: "For you" },
  { value: FeedScope.Following, label: "Following" },
  { value: FeedScope.Unread, label: "Unread" },
];

export const DEFAULT_FEED_SCOPE: FeedScope = FeedScope.ForYou;

export function parseFeedScope(value: string | undefined): FeedScope {
  return FEED_SCOPES.some((scope) => scope.value === value)
    ? (value as FeedScope)
    : DEFAULT_FEED_SCOPE;
}

export function feedHref(scope: FeedScope): string {
  return scope === DEFAULT_FEED_SCOPE
    ? "/my/dashboard"
    : `/my/dashboard?scope=${scope}`;
}

/**
 * "Updated 4 min ago" — what `computedAt` is for.
 *
 * **Never render this during the server pass.** It is a difference between two
 * clocks, one of which does not exist yet when the HTML is produced; putting
 * it in the first client render is a hydration mismatch, and a hydration
 * mismatch on this page kills every control on it. The caller holds it behind
 * a mounted flag — see `home-view.tsx`.
 */
export function formatUpdatedAt(computedAt: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - computedAt.getTime());
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return "Updated just now";
  if (minutes === 1) return "Updated 1 min ago";
  if (minutes < 60) return `Updated ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "Updated 1 hour ago";
  if (hours < 24) return `Updated ${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "Updated yesterday" : `Updated ${days} days ago`;
}

/** The copy for an empty scope. Name the specific emptiness, never "Nothing here". */
export function feedEmptyCopy(scope: FeedScope): {
  title: string;
  description: string;
} {
  switch (scope) {
    case FeedScope.Following:
      return {
        title: "Nobody you follow has shared anything yet.",
        description:
          "Following shows public saves from the people you follow. Explore is where you find them.",
      };
    case FeedScope.Unread:
      return {
        title: "You're caught up.",
        description:
          "Unread is every save you haven't opened, newest first. Read ones stay in your library.",
      };
    default:
      return {
        title: "Nothing ranked for you right now.",
        description:
          "For you mixes your unread saves, the people you follow, and this week's digests. Save something and it appears here.",
      };
  }
}
