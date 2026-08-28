import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Bookmark as BookmarkRow,
  Database,
  FeedDigestRow,
  FeedImpressionItemType,
  FeedImpressionRow,
} from "../database/schema";
import { PublicProfileRow } from "./social.repository";
import { DigestSourceRow, mapDigestSources } from "./digest.repository";
import { DigestSource } from "../types";
import { FeedRankingConfigOverrides } from "../services/feed-ranking.config";

/**
 * Everything the ranker needs to read, and the one thing it writes.
 *
 * The division of labour with `FeedRankingService` is deliberate and worth
 * stating, because the spec chose it: **the ranking happens in the API, not in
 * the database**. This file fetches candidates and the raw material of each
 * signal; it never orders by score, never applies a weight, and never decides
 * what a user sees. That keeps the whole ranking testable without a database,
 * which is why the ranker's guarantees can be asserted at all.
 *
 * The one place that boundary bends is topic affinity. Cosine similarity
 * against a 1,536-dimension vector for 500 candidates is not something to do
 * in JavaScript over the wire, so `similarityFor` returns similarities rather
 * than embeddings. The *weighting* of that similarity still happens in the
 * service.
 */

/** A followed user's public save, with its author attached. */
export interface FollowedSaveRow {
  bookmark: BookmarkRow;
  author: PublicProfileRow;
}

/** One finished read, reduced to the facts the signals need from it. */
export interface FinishedReadRow {
  sourceUrl: string;
  readAt: Date;
  /** `metadata->>'readingTime'`, in minutes. Null when the pipeline never set one. */
  readingTime: number | null;
  /**
   * `cosmic_tags`. Topic affinity's fallback reads these: an account whose
   * saves have not been embedded yet still gets its heaviest signal from
   * something, rather than a flat 0.5 for every candidate.
   */
  tags: string[] | null;
}

/**
 * A digest eligible to appear in this user's feed, with the domains of the
 * saves it was built from.
 *
 * The domains ride along because the ranker needs them and a second query per
 * digest would be three queries to place three items. They are the *source*
 * domains, not the digest's own — a digest has no domain of its own, which is
 * also why it can never extend an author-diversity run.
 */
export interface EligibleDigestRow {
  digest: FeedDigestRow;
  /**
   * The `Built from` row, complete. Fetched with the candidate rather than
   * after the ordering, because a digest with no sources is not a digest that
   * may be rendered — carrying them from the start means the render path has
   * no branch in which they are missing.
   */
  sources: DigestSource[];
  sourceDomains: string[];
  /** `cosmic_tags` of the sources, deduplicated. Feeds topic affinity's fallback. */
  sourceTags: string[];
  likedByViewer: boolean;
}

/** A save the user made, whether or not they ever read it. */
export interface SaveOutcomeRow {
  sourceUrl: string;
  read: boolean;
}

/** What the novelty penalty looks back over. */
export interface RecentlyServedRow {
  bookmarkId: string;
  sourceUrl: string;
  tags: string[] | null;
  lastServedAt: Date;
}

/** How many people the viewer follows have engaged with a candidate. */
export interface SocialProofRow {
  bookmarkId: string;
  /** Followed users who reshared it into their own library. */
  reshares: number;
  /** Followed users who liked it. */
  likes: number;
}

export interface FeedRepository {
  /**
   * Own unread saves inside the window, newest first, capped.
   *
   * `is_private_link` rows are included: a private link is a save the pipeline
   * was told not to fetch, not a save the owner should stop seeing.
   */
  findOwnUnread(
    userId: string,
    since: Date,
    limit: number
  ): Promise<BookmarkRow[]>;

  /**
   * Public saves from the people the viewer follows, newest first, capped.
   *
   * Block filtering is *not* done here. Blocking drops both follow edges in
   * the same transaction, so a blocked author cannot be in this result to
   * begin with; the service still asks the social graph about each distinct
   * author it got back, once per author rather than once per item, because
   * "cannot be" is a weaker guarantee than "was checked".
   */
  findFollowedSaves(
    userId: string,
    since: Date,
    limit: number
  ): Promise<FollowedSaveRow[]>;

  /** The user's saves that are still being processed. Pinned, never ranked. */
  findPending(userId: string, limit: number): Promise<BookmarkRow[]>;

  /**
   * Digests eligible for this user's feed, newest first.
   *
   * The third leg of the candidate set (docs/functional-spec/05-feed.md
   * § Ranking). A digest is built from the viewer's own library, so there is
   * no "followed digests" case: `user_id` is always the viewer, and a shared
   * digest reaches other people through its own link, not through their feed.
   */
  findEligibleDigests(
    userId: string,
    since: Date,
    limit: number
  ): Promise<EligibleDigestRow[]>;

  /**
   * Cosine similarity between each candidate and the viewer's interest vector,
   * in one round trip.
   *
   * The interest vector is the mean embedding of everything the viewer
   * finished in the window — derived, never stored
   * (docs/functional-spec/07-data-model.md). Returns an empty map when the
   * viewer has finished nothing embeddable, which is the new-user case and not
   * an error: the service falls back to tag overlap.
   */
  similarityToInterestVector(
    userId: string,
    bookmarkIds: string[],
    since: Date
  ): Promise<Map<string, number>>;

  /** Finished reads in the window — source affinity and effort fit both read this. */
  findFinishedReads(userId: string, since: Date, limit: number): Promise<FinishedReadRow[]>;

  /**
   * The denominator of source affinity: saves made, and whether each was ever
   * read. A domain the user saves from constantly and never finishes must
   * score *lower* than one they save from rarely and always finish.
   */
  findSaveOutcomes(userId: string, limit: number): Promise<SaveOutcomeRow[]>;

  /** Engagement on candidates by people the viewer follows. Nothing global. */
  findSocialProof(
    userId: string,
    bookmarkIds: string[]
  ): Promise<SocialProofRow[]>;

  /** Impressions for the candidates in hand, keyed `${itemType}:${itemId}`. */
  findImpressions(
    userId: string,
    items: { itemType: FeedImpressionItemType; itemId: string }[]
  ): Promise<Map<string, FeedImpressionRow>>;

  /** The last n items served to this user, newest first. */
  findRecentlyServed(userId: string, limit: number): Promise<RecentlyServedRow[]>;

  /** Ids served since a moment — how a lost paging session avoids repeating itself. */
  findServedSince(userId: string, since: Date): Promise<string[]>;

  /**
   * Record a page of impressions. Upsert: one row per (person, item), the
   * counter incremented in place.
   */
  recordImpressions(
    userId: string,
    items: { itemType: FeedImpressionItemType; itemId: string }[]
  ): Promise<void>;

  /**
   * "They went in." Idempotent, and it never *un*-opens: `opened_at` is set
   * once, by the first open.
   */
  markOpened(
    userId: string,
    itemType: FeedImpressionItemType,
    itemId: string
  ): Promise<void>;

  /**
   * The ranking overrides for this environment, or `null` when there is no row.
   *
   * A failure here returns `null` rather than throwing. The weights are a
   * tuning surface, and a tuning surface that can take the feed down when its
   * table is unreachable is worse than no tuning surface — the file values are
   * always a correct answer.
   */
  findRankingConfig(
    environment: string
  ): Promise<FeedRankingConfigOverrides | null>;
}

export class FeedRepositoryImpl
  extends BaseRepository
  implements FeedRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findOwnUnread(
    userId: string,
    since: Date,
    limit: number
  ): Promise<BookmarkRow[]> {
    return this.executeQuery(async () => {
      return await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        .where("read_at", "is", null)
        .where("is_archived", "=", false)
        .where("created_at", ">=", since)
        // A save still in the pipeline is a `pending` item, which is pinned
        // rather than ranked — `findPending` owns it, and having it in both
        // sets would put the same bookmark on the page twice.
        .where("processing_status", "!=", "processing")
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit)
        .execute();
    }, "findOwnUnread");
  }

  async findFollowedSaves(
    userId: string,
    since: Date,
    limit: number
  ): Promise<FollowedSaveRow[]> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("bookmarks")
        .innerJoin("follows", "follows.following_id", "bookmarks.user_id")
        .innerJoin("profiles", "profiles.id", "bookmarks.user_id")
        .selectAll("bookmarks")
        .select([
          "profiles.id as author_id",
          "profiles.handle as author_handle",
          "profiles.name as author_name",
          "profiles.picture_url as author_picture_url",
          "profiles.created_at as author_created_at",
        ])
        .where("follows.follower_id", "=", userId)
        // The three conditions that make a save public, matching
        // `idx_bookmarks_public_recent` exactly so the partial index is usable.
        .where("bookmarks.is_public", "=", true)
        .where("bookmarks.is_archived", "=", false)
        .where("bookmarks.created_at", ">=", since)
        .orderBy("bookmarks.created_at", "desc")
        .orderBy("bookmarks.id", "desc")
        .limit(limit)
        .execute();

      return rows.map((row) => {
        const {
          author_id,
          author_handle,
          author_name,
          author_picture_url,
          author_created_at,
          ...bookmark
        } = row as typeof row & Record<string, unknown>;

        return {
          bookmark: bookmark as unknown as BookmarkRow,
          author: {
            id: author_id,
            handle: author_handle,
            name: author_name,
            picture_url: author_picture_url,
            created_at: author_created_at,
          },
        };
      });
    }, "findFollowedSaves");
  }

  async findPending(userId: string, limit: number): Promise<BookmarkRow[]> {
    return this.executeQuery(async () => {
      return await this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        .where("is_archived", "=", false)
        .where("processing_status", "=", "processing")
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit)
        .execute();
    }, "findPending");
  }

  async findEligibleDigests(
    userId: string,
    since: Date,
    limit: number
  ): Promise<EligibleDigestRow[]> {
    return this.executeQuery(async () => {
      const digests = await this.db
        .selectFrom("feed_digests")
        .selectAll()
        .where("user_id", "=", userId)
        .where("created_at", ">=", since)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute();

      if (digests.length === 0) return [];

      // Two queries for the whole page: every source of every digest, and the
      // viewer's likes across them. Not one query per digest — the digest
      // spacing rule means there are at most three of these, and it would
      // still be the wrong shape at three.
      const sourceIds = [
        ...new Set(digests.flatMap((row) => row.source_bookmark_ids ?? [])),
      ];

      const [sources, likes] = await Promise.all([
        this.db
          .selectFrom("bookmarks")
          .select(["id", "title", "source_url", "metadata", "cosmic_tags"])
          .where("id", "in", sourceIds)
          .execute(),
        this.db
          .selectFrom("feed_digest_likes")
          .select("digest_id")
          .where("user_id", "=", userId)
          .where(
            "digest_id",
            "in",
            digests.map((row) => row.id)
          )
          .execute(),
      ]);

      const byId = new Map(sources.map((row) => [row.id, row]));
      const liked = new Set(likes.map((row) => row.digest_id));

      return digests.map((digest) => {
        const domains = new Set<string>();
        const tags = new Set<string>();

        for (const id of digest.source_bookmark_ids ?? []) {
          const source = byId.get(id);
          if (!source) continue;
          const domain = domainOfUrl(source.source_url);
          if (domain) domains.add(domain);
          for (const tag of source.cosmic_tags ?? []) tags.add(tag);
        }

        return {
          digest,
          sources: mapDigestSources(
            digest.source_bookmark_ids ?? [],
            sources as DigestSourceRow[]
          ),
          sourceDomains: [...domains],
          sourceTags: [...tags],
          likedByViewer: liked.has(digest.id),
        };
      });
    }, "findEligibleDigests");
  }

  async similarityToInterestVector(
    userId: string,
    bookmarkIds: string[],
    since: Date
  ): Promise<Map<string, number>> {
    if (bookmarkIds.length === 0) return new Map();

    return this.executeQuery(async () => {
      // Three CTEs and one distance operator.
      //
      // `interest` is the mean of the mean: every finished bookmark
      // contributes one vector, whatever its length, so a 40-chunk essay does
      // not outvote a 3-chunk note. `candidate` is the same per-bookmark mean
      // for the rows being ranked.
      //
      // The whole thing produces nothing rather than failing when the viewer
      // has finished nothing embeddable — the cross join with `interest` sees
      // a null vector, the filter removes it, and the result set is empty,
      // which the service reads as "no interest vector yet".
      //
      // **`AS MATERIALIZED` is load-bearing, not decoration.** Without it the
      // planner is free to drive the `finished` join from `text_chunks` and
      // filter afterwards — a sequential scan of every embedded chunk in the
      // instance to build one reader's vector, which is exactly the cost that
      // would force this onto a nightly job. Pinning the small user-scoped id
      // list first makes every join below it an index lookup:
      // `idx_scraped_url_contents_bookmark_id`,
      // `idx_content_chunks_scraped_content`, and `text_chunks`' primary key.
      const result = await sql<{ bookmark_id: string; similarity: number }>`
        WITH finished_ids AS MATERIALIZED (
          SELECT id
          FROM bookmarks
          WHERE user_id = ${userId}
            AND read_at IS NOT NULL
            AND read_at >= ${since}
        ),
        finished AS (
          SELECT AVG(tc.embedding) AS embedding
          FROM finished_ids b
          JOIN scraped_url_contents suc ON suc.bookmark_id = b.id
          JOIN content_chunks cc ON cc.scraped_content_id = suc.id
          JOIN text_chunks tc ON tc.chunk_id = cc.id
          WHERE tc.embedding IS NOT NULL
          GROUP BY b.id
        ),
        interest AS (
          SELECT AVG(embedding) AS embedding FROM finished
        ),
        candidate_ids AS MATERIALIZED (
          SELECT unnest(${bookmarkIds}::uuid[]) AS id
        ),
        candidate AS (
          SELECT suc.bookmark_id AS bookmark_id, AVG(tc.embedding) AS embedding
          FROM candidate_ids ci
          JOIN scraped_url_contents suc ON suc.bookmark_id = ci.id
          JOIN content_chunks cc ON cc.scraped_content_id = suc.id
          JOIN text_chunks tc ON tc.chunk_id = cc.id
          WHERE tc.embedding IS NOT NULL
          GROUP BY suc.bookmark_id
        )
        SELECT
          candidate.bookmark_id::text AS bookmark_id,
          1 - (candidate.embedding <=> interest.embedding) AS similarity
        FROM candidate, interest
        WHERE interest.embedding IS NOT NULL
      `.execute(this.db);

      const map = new Map<string, number>();
      for (const row of result.rows) {
        const value = Number(row.similarity);
        if (Number.isFinite(value)) map.set(row.bookmark_id, value);
      }
      return map;
    }, "similarityToInterestVector");
  }

  async findFinishedReads(
    userId: string,
    since: Date,
    limit: number
  ): Promise<FinishedReadRow[]> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("bookmarks")
        .select(["source_url", "read_at", "cosmic_tags"])
        .select(sql<string | null>`metadata->>'readingTime'`.as("reading_time"))
        .where("user_id", "=", userId)
        .where("read_at", "is not", null)
        .where("read_at", ">=", since)
        .orderBy("read_at", "desc")
        .limit(limit)
        .execute();

      return rows.map((row) => ({
        sourceUrl: row.source_url,
        readAt: row.read_at as Date,
        readingTime: toFiniteNumber(row.reading_time),
        tags: row.cosmic_tags,
      }));
    }, "findFinishedReads");
  }

  async findSaveOutcomes(
    userId: string,
    limit: number
  ): Promise<SaveOutcomeRow[]> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("bookmarks")
        .select(["source_url", "read_at"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute();

      return rows.map((row) => ({
        sourceUrl: row.source_url,
        read: row.read_at !== null,
      }));
    }, "findSaveOutcomes");
  }

  async findSocialProof(
    userId: string,
    bookmarkIds: string[]
  ): Promise<SocialProofRow[]> {
    if (bookmarkIds.length === 0) return [];

    return this.executeQuery(async () => {
      // Both halves are scoped to people the viewer follows. Nothing here
      // counts the world: a global count would be a popularity signal, and
      // docs/functional-spec/05-feed.md forbids one.
      const result = await sql<{
        bookmark_id: string;
        reshares: string;
        likes: string;
      }>`
        WITH ids AS (SELECT unnest(${bookmarkIds}::uuid[]) AS id),
        followed AS (
          SELECT following_id AS id FROM follows WHERE follower_id = ${userId}
        )
        SELECT
          ids.id::text AS bookmark_id,
          (SELECT count(*) FROM bookmarks r
             JOIN followed ON followed.id = r.user_id
            WHERE r.saved_from_bookmark_id = ids.id) AS reshares,
          (SELECT count(*) FROM bookmark_likes l
             JOIN followed ON followed.id = l.user_id
            WHERE l.bookmark_id = ids.id) AS likes
        FROM ids
      `.execute(this.db);

      return result.rows.map((row) => ({
        bookmarkId: row.bookmark_id,
        reshares: Number(row.reshares ?? 0),
        likes: Number(row.likes ?? 0),
      }));
    }, "findSocialProof");
  }

  async findImpressions(
    userId: string,
    items: { itemType: FeedImpressionItemType; itemId: string }[]
  ): Promise<Map<string, FeedImpressionRow>> {
    if (items.length === 0) return new Map();

    return this.executeQuery(async () => {
      const ids = [...new Set(items.map((item) => item.itemId))];

      const rows = await this.db
        .selectFrom("feed_impressions")
        .selectAll()
        .where("user_id", "=", userId)
        .where("item_id", "in", ids)
        .execute();

      return new Map(
        rows.map((row) => [impressionKey(row.item_type, row.item_id), row])
      );
    }, "findImpressions");
  }

  async findRecentlyServed(
    userId: string,
    limit: number
  ): Promise<RecentlyServedRow[]> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("feed_impressions")
        .innerJoin("bookmarks", "bookmarks.id", "feed_impressions.item_id")
        .select([
          "bookmarks.id as id",
          "bookmarks.source_url as source_url",
          "bookmarks.cosmic_tags as cosmic_tags",
          "feed_impressions.last_served_at as last_served_at",
        ])
        .where("feed_impressions.user_id", "=", userId)
        .where("feed_impressions.item_type", "=", "bookmark")
        .orderBy("feed_impressions.last_served_at", "desc")
        .limit(limit)
        .execute();

      return rows.map((row) => ({
        bookmarkId: row.id,
        sourceUrl: row.source_url,
        tags: row.cosmic_tags,
        lastServedAt: row.last_served_at,
      }));
    }, "findRecentlyServed");
  }

  async findServedSince(userId: string, since: Date): Promise<string[]> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("feed_impressions")
        .select("item_id")
        .where("user_id", "=", userId)
        .where("last_served_at", ">=", since)
        .execute();

      return rows.map((row) => row.item_id);
    }, "findServedSince");
  }

  async recordImpressions(
    userId: string,
    items: { itemType: FeedImpressionItemType; itemId: string }[]
  ): Promise<void> {
    if (items.length === 0) return;

    await this.executeQuery(async () => {
      const seen = new Set<string>();
      const values = [];

      for (const item of items) {
        const key = impressionKey(item.itemType, item.itemId);
        if (seen.has(key)) continue;
        seen.add(key);
        values.push({
          user_id: userId,
          item_type: item.itemType,
          item_id: item.itemId,
        });
      }

      await this.db
        .insertInto("feed_impressions")
        .values(values)
        // Increment in place. A read-then-write would race with the same
        // user's other tab and lose counts, which would quietly turn seen
        // decay off for exactly the people who read on two devices.
        .onConflict((oc) =>
          oc.columns(["user_id", "item_type", "item_id"]).doUpdateSet({
            served_count: sql`feed_impressions.served_count + 1`,
            last_served_at: sql`now()`,
          })
        )
        .execute();
    }, "recordImpressions");
  }

  async markOpened(
    userId: string,
    itemType: FeedImpressionItemType,
    itemId: string
  ): Promise<void> {
    await this.executeQuery(async () => {
      await this.db
        .insertInto("feed_impressions")
        .values({
          user_id: userId,
          item_type: itemType,
          item_id: itemId,
          // Opening something the feed never served is possible — the library,
          // a shared link, a search result — and it still means "they went
          // in". The row is created rather than skipped so the open is not
          // lost if the feed shows the item later.
          served_count: 0,
          opened_at: new Date(),
        })
        .onConflict((oc) =>
          oc
            .columns(["user_id", "item_type", "item_id"])
            .doUpdateSet({ opened_at: sql`COALESCE(feed_impressions.opened_at, now())` })
        )
        .execute();
    }, "markOpened");
  }

  async findRankingConfig(
    environment: string
  ): Promise<FeedRankingConfigOverrides | null> {
    try {
      const row = await this.db
        .selectFrom("feed_ranking_config")
        .select(["weights", "parameters"])
        .where("environment", "=", environment)
        .executeTakeFirst();

      if (!row) return null;

      return { weights: row.weights, parameters: row.parameters };
    } catch {
      // Deliberately swallowed — see the interface. The caller falls back to
      // the compiled-in values, which is the correct ranking, not a degraded
      // one.
      return null;
    }
  }
}

export function impressionKey(
  itemType: FeedImpressionItemType,
  itemId: string
): string {
  return `${itemType}:${itemId}`;
}

/** Bare host, no `www.`, never throws. Mirrors the ranker's own `domainOf`. */
function domainOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toFiniteNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
