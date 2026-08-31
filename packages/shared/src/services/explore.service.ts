import {
  ExploreRailResponse,
  ExploreResponse,
  ExploreTopic,
  FeedItem,
  TrendingCollection,
  TrendingPerson,
} from "../types";
import {
  EXPLORE_WINDOW_DAYS,
  ExploreKeyset,
  ExploreRepository,
} from "../repositories/explore.repository";
import { mapDatabaseRowToBookmark } from "./bookmark.service";

/**
 * Explore — docs/design-system/pages.md § Explore.
 *
 * The one sentence that explains every decision in this file: **Explore is not
 * a second Home.** Home ranks what is useful to *you*, out of your own saves
 * and the people you follow. Explore ranks what the product as a whole is
 * engaging with, out of everybody's public saves, and it deliberately excludes
 * your own — a discovery surface that shows you your own library has
 * discovered nothing.
 *
 * There is no interest vector here, no source affinity and no effort fit. All
 * three are personalisation, all three are `FeedRankingService`'s, and adding
 * any of them would quietly turn this into Home with a different header.
 *
 * ### The reason string
 *
 * Explore writes `rankingReason` for the same contract Home's does: the server
 * says why an item is present, the client never invents it
 * (docs/functional-spec/05-feed.md § Why this appeared). Explore's reasons are
 * short because its ranking is: engagement inside a window, and who saved it.
 */

/** Page size and its ceiling, matching the feed's. */
export const EXPLORE_PAGE_DEFAULT_LIMIT = 20;
export const EXPLORE_PAGE_MAX_LIMIT = 50;

/** How many options the topic segmented control offers. */
export const EXPLORE_TOPIC_LIMIT = 6;

export interface ExplorePageOptions {
  topic?: string | null;
  limit?: number;
  cursor?: ExploreKeyset | null;
}

/** A page, plus the raw keyset the API layer encodes into an opaque cursor. */
export interface ExplorePage extends Omit<ExploreResponse, "nextCursor"> {
  lastRow: ExploreKeyset | null;
}

export interface ExploreService {
  list(viewerId: string, options?: ExplorePageOptions): Promise<ExplorePage>;

  rail(
    viewerId: string,
    options?: { collectionLimit?: number; peopleLimit?: number }
  ): Promise<ExploreRailResponse>;
}

export class ExploreServiceImpl implements ExploreService {
  constructor(private exploreRepository: ExploreRepository) {}

  async list(
    viewerId: string,
    options: ExplorePageOptions = {}
  ): Promise<ExplorePage> {
    const limit = clampLimit(options.limit);
    const since = windowStart();

    // Two reads, one wait. The topic control belongs to the same surface and a
    // second round trip for six strings would reflow the page for nothing.
    const [candidates, topics] = await Promise.all([
      this.exploreRepository.findDiscoveryCandidates(viewerId, {
        since,
        // One extra row, so "the page is full" and "there is more" can be told
        // apart without a count query.
        limit: limit + 1,
        topic: options.topic ?? null,
        cursor: options.cursor ?? null,
      }),
      this.exploreRepository.findTrendingTopics(
        viewerId,
        since,
        EXPLORE_TOPIC_LIMIT
      ),
    ]);

    const hasMore = candidates.length > limit;
    const page = hasMore ? candidates.slice(0, limit) : candidates;
    const last = hasMore ? page[page.length - 1] ?? null : null;

    const items: FeedItem[] = page.map((row) => ({
      // Everything in Explore reached the reader through someone else, which
      // is exactly what `followed_save` means to the client's provenance row —
      // "shared", with an actor. It is the honest type even though the reader
      // does not follow them: the alternative, `own_save`, would be a lie
      // about whose save it is.
      type: "followed_save",
      bookmark: mapDatabaseRowToBookmark(row.bookmark),
      actor: {
        id: row.author.id,
        handle: row.author.handle ?? "",
        name: row.author.name ?? undefined,
        pictureUrl: row.author.picture_url ?? undefined,
      },
      rankingReason: reasonFor(row.bookmark, row.author.name),
    }));

    const exploreTopics: ExploreTopic[] = topics.map((row) => ({
      topic: row.topic,
      count: row.count,
    }));

    return {
      items,
      topics: exploreTopics,
      computedAt: new Date(),
      lastRow: last
        ? {
            score: last.score,
            createdAt: new Date(last.bookmark.created_at),
            id: last.bookmark.id,
          }
        : null,
    };
  }

  async rail(
    viewerId: string,
    options: { collectionLimit?: number; peopleLimit?: number } = {}
  ): Promise<ExploreRailResponse> {
    const collectionLimit = clampSmall(options.collectionLimit, 4);
    const peopleLimit = clampSmall(options.peopleLimit, 5);
    const since = windowStart();

    const [collections, people] = await Promise.all([
      this.exploreRepository.findTrendingCollections(viewerId, collectionLimit),
      this.exploreRepository.findTrendingPeople(viewerId, since, peopleLimit),
    ]);

    const trendingCollections: TrendingCollection[] = collections.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      saveCount: row.save_count,
      owner: {
        id: row.owner.id,
        handle: row.owner.handle ?? "",
        name: row.owner.name ?? undefined,
        pictureUrl: row.owner.picture_url ?? undefined,
      },
    }));

    const trendingPeople: TrendingPerson[] = people.map((row) => ({
      person: {
        id: row.profile.id,
        handle: row.profile.handle ?? "",
        name: row.profile.name ?? undefined,
        pictureUrl: row.profile.picture_url ?? undefined,
      },
      savesThisWeek: row.saves_in_window,
      followers: row.followers,
      isFollowedByViewer: row.is_followed_by_viewer,
    }));

    return { collections: trendingCollections, people: trendingPeople };
  }
}

function windowStart(): Date {
  return new Date(Date.now() - EXPLORE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return EXPLORE_PAGE_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), EXPLORE_PAGE_MAX_LIMIT);
}

function clampSmall(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), 20);
}

/**
 * Why this appeared, said once and said accurately.
 *
 * Each branch is read off a number that is either there or is not. Nothing
 * here interpolates a signal the ranker did not use, and the fallback names
 * the only thing Explore can always honestly claim: it is public and it is
 * recent.
 */
export function reasonFor(
  bookmark: { like_count?: number; comment_count?: number },
  authorName?: string | null
): string {
  const likes = bookmark.like_count ?? 0;
  const comments = bookmark.comment_count ?? 0;

  if (comments > 0) {
    return comments === 1
      ? "Being discussed — 1 comment"
      : `Being discussed — ${comments} comments`;
  }

  if (likes > 0) {
    return likes === 1 ? "Liked by 1 person" : `Liked by ${likes} people`;
  }

  const who = authorName?.trim();
  return who ? `Recently shared by ${who}` : "Recently shared publicly";
}
