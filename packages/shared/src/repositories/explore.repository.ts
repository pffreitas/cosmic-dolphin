import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import { Bookmark as BookmarkRow, Database } from "../database/schema";
import { PUBLIC_PROFILE_COLUMNS, PublicProfileRow } from "./social.repository";

/**
 * Explore's reads — docs/design-system/pages.md § Explore.
 *
 * Every statement in this file is bounded by the same three conditions, and
 * they are the whole security model of the surface:
 *
 *  1. `bookmarks.is_public = true AND NOT is_archived`. Explore never reaches a
 *     private save. Archiving is how somebody takes a save out of circulation
 *     without deleting it, and Explore honours it.
 *  2. `user_id <> viewer`. Explore is where you find what you do not already
 *     have; a reader's own saves are Home's and the Library's job.
 *  3. Neither side of a block. Expressed as `NOT EXISTS` over `user_blocks` in
 *     both directions rather than as a join, so a blocked author drops out of
 *     the candidate set instead of being filtered out of a page — the
 *     difference matters for pagination, where filtering after the fact
 *     silently shortens pages.
 *
 * The ranking itself is arithmetic over columns that already exist
 * (`like_count`, `comment_count`, `created_at`) and nothing else. There is no
 * embedding read here on purpose: Home ranks by what *this* reader finds
 * useful, Explore ranks by what the product as a whole is engaging with, and
 * personalising Explore would make it a second Home with a different name.
 */

/** A candidate for Explore, with the score the query gave it. */
export interface ExploreCandidateRow {
  bookmark: BookmarkRow;
  author: PublicProfileRow;
  /** The discovery score. Descending, with `(created_at, id)` breaking ties. */
  score: number;
}

/** Where a page of Explore resumes. Score first, then the row's own identity. */
export interface ExploreKeyset {
  score: number;
  createdAt: Date;
  id: string;
}

export interface ExploreTopicRow {
  topic: string;
  count: number;
}

export interface TrendingCollectionRow {
  id: string;
  name: string;
  description: string | null;
  save_count: number;
  owner: PublicProfileRow;
}

export interface TrendingPersonRow {
  profile: PublicProfileRow;
  saves_in_window: number;
  followers: number;
  is_followed_by_viewer: boolean;
}

export interface ExploreRepository {
  /**
   * A page of public saves ranked for discovery.
   *
   * `topic` matches one `cosmicTags` entry case-insensitively. Absent means
   * every topic.
   */
  findDiscoveryCandidates(
    viewerId: string,
    options: {
      since: Date;
      limit: number;
      topic?: string | null;
      cursor?: ExploreKeyset | null;
    }
  ): Promise<ExploreCandidateRow[]>;

  /** The topics the segmented control offers, most-saved first. */
  findTrendingTopics(
    viewerId: string,
    since: Date,
    limit: number
  ): Promise<ExploreTopicRow[]>;

  /** Public collections with the most public saves in them. */
  findTrendingCollections(
    viewerId: string,
    limit: number
  ): Promise<TrendingCollectionRow[]>;

  /** People with public output in the window, most followed first. */
  findTrendingPeople(
    viewerId: string,
    since: Date,
    limit: number
  ): Promise<TrendingPersonRow[]>;
}

/**
 * How long back Explore looks. Thirty days, matching the feed's own window.
 *
 * Long enough that a product with a few dozen public saves has something to
 * show; short enough that Explore is a picture of now rather than an all-time
 * leaderboard, which would never change and would stop being worth opening.
 */
export const EXPLORE_WINDOW_DAYS = 30;

/**
 * The discovery score, in one place.
 *
 * `(1 + likes + 2·comments)` — a comment costs more than a like, so it is
 * worth more — divided by a gentle age penalty in days. The `1 +` is what
 * keeps a brand-new save with no engagement above an old one with none, which
 * is the behaviour a young product needs: with a bare engagement sort, Explore
 * on an empty graph is an arbitrary permutation.
 *
 * Written as SQL rather than sorted in memory because it has to be the same
 * expression the cursor compares against — a score computed in TypeScript
 * cannot appear in a `WHERE` clause, and a keyset cursor that cannot be
 * compared in SQL is an offset with extra steps.
 */
const SCORE_SQL = sql<number>`
  (1 + bookmarks.like_count + 2 * bookmarks.comment_count)::float8
  / (1 + extract(epoch from (now() - bookmarks.created_at)) / 86400.0)
`;

export class ExploreRepositoryImpl
  extends BaseRepository
  implements ExploreRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findDiscoveryCandidates(
    viewerId: string,
    options: {
      since: Date;
      limit: number;
      topic?: string | null;
      cursor?: ExploreKeyset | null;
    }
  ): Promise<ExploreCandidateRow[]> {
    return this.executeQuery(async () => {
      const topic = options.topic?.trim().toLowerCase() || null;
      const cursor = options.cursor ?? null;

      // Composed rather than expressed as an always-present predicate with a
      // null guard: the planner gets a simpler statement, and the intent —
      // "no cursor means no cursor clause" — is legible.
      const topicClause = topic
        ? sql`AND EXISTS (
              SELECT 1 FROM unnest(coalesce(bookmarks.cosmic_tags, '{}'::text[])) AS tag
              WHERE lower(tag) = ${topic}
            )`
        : sql``;

      const cursorClause = cursor
        ? sql`AND (${SCORE_SQL}, bookmarks.created_at, bookmarks.id)
              < (${cursor.score}::float8, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
        : sql``;

      const result = await sql<
        BookmarkRow & {
          score: number;
          author_id: string;
          author_handle: string | null;
          author_name: string | null;
          author_picture_url: string | null;
          author_created_at: Date;
        }
      >`
        SELECT
          bookmarks.*,
          ${SCORE_SQL} AS score,
          profiles.id           AS author_id,
          profiles.handle       AS author_handle,
          profiles.name         AS author_name,
          profiles.picture_url  AS author_picture_url,
          profiles.created_at   AS author_created_at
        FROM bookmarks
        JOIN profiles ON profiles.id = bookmarks.user_id
        WHERE bookmarks.is_public = true
          AND bookmarks.is_archived = false
          AND bookmarks.user_id <> ${viewerId}
          AND bookmarks.created_at >= ${options.since}
          AND profiles.handle IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks
            WHERE (blocker_id = ${viewerId} AND blocked_id = bookmarks.user_id)
               OR (blocker_id = bookmarks.user_id AND blocked_id = ${viewerId})
          )
          ${topicClause}
          ${cursorClause}
        ORDER BY score DESC, bookmarks.created_at DESC, bookmarks.id DESC
        LIMIT ${options.limit}
      `.execute(this.db);

      return result.rows.map((row) => {
        const {
          score,
          author_id,
          author_handle,
          author_name,
          author_picture_url,
          author_created_at,
          ...bookmark
        } = row;

        return {
          bookmark: bookmark as unknown as BookmarkRow,
          author: {
            id: author_id,
            handle: author_handle,
            name: author_name,
            picture_url: author_picture_url,
            created_at: author_created_at,
          },
          score: Number(score),
        };
      });
    }, "findDiscoveryCandidates");
  }

  async findTrendingTopics(
    viewerId: string,
    since: Date,
    limit: number
  ): Promise<ExploreTopicRow[]> {
    return this.executeQuery(async () => {
      const result = await sql<{ topic: string; count: string }>`
        SELECT lower(tag) AS topic, count(*) AS count
        FROM bookmarks,
             unnest(coalesce(bookmarks.cosmic_tags, '{}'::text[])) AS tag
        WHERE bookmarks.is_public = true
          AND bookmarks.is_archived = false
          AND bookmarks.user_id <> ${viewerId}
          AND bookmarks.created_at >= ${since}
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks
            WHERE (blocker_id = ${viewerId} AND blocked_id = bookmarks.user_id)
               OR (blocker_id = bookmarks.user_id AND blocked_id = ${viewerId})
          )
        GROUP BY lower(tag)
        ORDER BY count DESC, topic ASC
        LIMIT ${limit}
      `.execute(this.db);

      return result.rows.map((row) => ({
        topic: row.topic,
        count: Number(row.count),
      }));
    }, "findTrendingTopics");
  }

  async findTrendingCollections(
    viewerId: string,
    limit: number
  ): Promise<TrendingCollectionRow[]> {
    return this.executeQuery(async () => {
      const result = await sql<{
        id: string;
        name: string;
        description: string | null;
        save_count: string;
        owner_id: string;
        owner_handle: string | null;
        owner_name: string | null;
        owner_picture_url: string | null;
        owner_created_at: Date;
      }>`
        SELECT
          collections.id,
          collections.name,
          collections.description,
          count(bookmarks.id) AS save_count,
          profiles.id          AS owner_id,
          profiles.handle      AS owner_handle,
          profiles.name        AS owner_name,
          profiles.picture_url AS owner_picture_url,
          profiles.created_at  AS owner_created_at
        FROM collections
        JOIN profiles ON profiles.id = collections.user_id
        -- INNER, not LEFT: a public collection with nothing public in it is
        -- not trending, it is empty, and recommending it wastes the row.
        JOIN bookmarks
          ON bookmarks.collection_id = collections.id
         AND bookmarks.is_public = true
         AND bookmarks.is_archived = false
        WHERE collections.is_public = true
          AND collections.user_id <> ${viewerId}
          AND profiles.handle IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks
            WHERE (blocker_id = ${viewerId} AND blocked_id = collections.user_id)
               OR (blocker_id = collections.user_id AND blocked_id = ${viewerId})
          )
        GROUP BY collections.id, collections.name, collections.description,
                 profiles.id, profiles.handle, profiles.name,
                 profiles.picture_url, profiles.created_at
        ORDER BY save_count DESC, collections.created_at DESC
        LIMIT ${limit}
      `.execute(this.db);

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        save_count: Number(row.save_count),
        owner: {
          id: row.owner_id,
          handle: row.owner_handle,
          name: row.owner_name,
          picture_url: row.owner_picture_url,
          created_at: row.owner_created_at,
        },
      }));
    }, "findTrendingCollections");
  }

  async findTrendingPeople(
    viewerId: string,
    since: Date,
    limit: number
  ): Promise<TrendingPersonRow[]> {
    return this.executeQuery(async () => {
      const result = await sql<{
        id: string;
        handle: string | null;
        name: string | null;
        picture_url: string | null;
        created_at: Date;
        saves_in_window: string;
        followers: string;
        is_followed_by_viewer: boolean;
      }>`
        SELECT
          profiles.id,
          profiles.handle,
          profiles.name,
          profiles.picture_url,
          profiles.created_at,
          count(bookmarks.id) AS saves_in_window,
          (SELECT count(*) FROM follows WHERE following_id = profiles.id) AS followers,
          EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id = ${viewerId} AND following_id = profiles.id
          ) AS is_followed_by_viewer
        FROM profiles
        JOIN bookmarks
          ON bookmarks.user_id = profiles.id
         AND bookmarks.is_public = true
         AND bookmarks.is_archived = false
         AND bookmarks.created_at >= ${since}
        WHERE profiles.id <> ${viewerId}
          AND profiles.handle IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks
            WHERE (blocker_id = ${viewerId} AND blocked_id = profiles.id)
               OR (blocker_id = profiles.id AND blocked_id = ${viewerId})
          )
        GROUP BY profiles.id, profiles.handle, profiles.name,
                 profiles.picture_url, profiles.created_at
        -- Someone the reader already follows is not a recommendation, but they
        -- are not a mistake either: they sort last rather than disappearing,
        -- so a reader who follows everybody still sees a populated rail.
        ORDER BY is_followed_by_viewer ASC, saves_in_window DESC, followers DESC
        LIMIT ${limit}
      `.execute(this.db);

      return result.rows.map((row) => ({
        profile: {
          id: row.id,
          handle: row.handle,
          name: row.name,
          picture_url: row.picture_url,
          created_at: row.created_at,
        },
        saves_in_window: Number(row.saves_in_window),
        followers: Number(row.followers),
        is_followed_by_viewer: Boolean(row.is_followed_by_viewer),
      }));
    }, "findTrendingPeople");
  }
}

/** Referenced so the public column list and this file cannot drift apart. */
export const EXPLORE_PROFILE_COLUMNS = PUBLIC_PROFILE_COLUMNS;
