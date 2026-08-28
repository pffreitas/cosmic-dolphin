import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import { Bookmark as BookmarkRow, Database } from "../database/schema";

/**
 * The follow graph, the block list, and the reads that hang off them.
 *
 * One rule shapes this whole file: **`email` is never selected**. Every
 * statement that produces a profile for public consumption lists its columns
 * explicitly, from `PUBLIC_PROFILE_COLUMNS`, so a public profile is not an
 * object with a sensitive field that someone remembered to delete — it is an
 * object that never held one. `selectAll()` does not appear here, and should
 * not be introduced.
 */

/**
 * The only shape a public read of `profiles` ever produces.
 *
 * Note what is absent. Adding `email` here would also have to get past
 * `assertPublicProfileHasNoEmail` in `types.ts`, which stops compiling the
 * moment the field exists on `PublicProfile`.
 */
export interface PublicProfileRow {
  id: string;
  handle: string | null;
  name: string | null;
  picture_url: string | null;
  created_at: Date;
}

/**
 * The column list, in one place, referenced by every public read.
 *
 * `as const` matters: it is what makes `PublicProfileRow` and this list drift
 * apart at compile time rather than at runtime.
 */
export const PUBLIC_PROFILE_COLUMNS = [
  "id",
  "handle",
  "name",
  "picture_url",
  "created_at",
] as const;

/** Where a page of followers, following, or public saves resumes. */
export interface SocialKeyset {
  createdAt: Date;
  id: string;
}

/** Everything the caller's view of another profile turns on, in one round trip. */
export interface RelationshipState {
  /** The caller follows them. */
  viewerFollows: boolean;
  /** They follow the caller. */
  followsViewer: boolean;
  /** The caller blocked them. */
  viewerBlocked: boolean;
  /** They blocked the caller. This is the one that makes things disappear. */
  blockedViewer: boolean;
}

export interface ProfileCountsRow {
  followers: number;
  following: number;
  publicSaves: number;
  collections: number;
}

export interface SocialRepository {
  findPublicProfileByHandle(handle: string): Promise<PublicProfileRow | null>;
  findPublicProfileById(id: string): Promise<PublicProfileRow | null>;
  countsFor(userId: string): Promise<ProfileCountsRow>;
  relationship(viewerId: string, otherId: string): Promise<RelationshipState>;

  /** Idempotent. Following twice is one row and one follower. */
  follow(followerId: string, followingId: string): Promise<void>;
  unfollow(followerId: string, followingId: string): Promise<void>;

  /**
   * Insert the block and drop **both** follow edges in one transaction. Two
   * statements a caller could interleave would leave a follow surviving a
   * block, which is the one outcome a block exists to prevent.
   */
  block(blockerId: string, blockedId: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;

  listFollowers(
    userId: string,
    limit: number,
    cursor?: SocialKeyset | null
  ): Promise<PublicProfileRow[]>;

  listFollowing(
    userId: string,
    limit: number,
    cursor?: SocialKeyset | null
  ): Promise<PublicProfileRow[]>;

  listPublicSaves(
    userId: string,
    limit: number,
    cursor?: SocialKeyset | null
  ): Promise<BookmarkRow[]>;
}

export class SocialRepositoryImpl
  extends BaseRepository
  implements SocialRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findPublicProfileByHandle(
    handle: string
  ): Promise<PublicProfileRow | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        // Handles are stored lowercase and the CHECK constraint enforces it,
        // so an exact match is a case-insensitive match — without giving up
        // the unique index the way `lower(handle) = …` would.
        .where("handle", "=", handle)
        .executeTakeFirst();

      return result ?? null;
    }, "findPublicProfileByHandle");
  }

  async findPublicProfileById(id: string): Promise<PublicProfileRow | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .where("id", "=", id)
        .executeTakeFirst();

      return result ?? null;
    }, "findPublicProfileById");
  }

  async countsFor(userId: string): Promise<ProfileCountsRow> {
    return this.executeQuery(async () => {
      // Four counts, one round trip. A profile page that issued four queries
      // would be four times the latency for a header that renders all at once.
      const result = await sql<{
        followers: string;
        following: string;
        public_saves: string;
        collections: string;
      }>`
        SELECT
          (SELECT count(*) FROM follows WHERE following_id = ${userId}) AS followers,
          (SELECT count(*) FROM follows WHERE follower_id = ${userId}) AS following,
          (SELECT count(*) FROM bookmarks
             WHERE user_id = ${userId} AND is_public = true AND NOT is_archived) AS public_saves,
          (SELECT count(*) FROM collections
             WHERE user_id = ${userId} AND is_public = true) AS collections
      `.execute(this.db);

      const row = result.rows[0];

      return {
        followers: Number(row?.followers ?? 0),
        following: Number(row?.following ?? 0),
        publicSaves: Number(row?.public_saves ?? 0),
        collections: Number(row?.collections ?? 0),
      };
    }, "countsFor");
  }

  async relationship(
    viewerId: string,
    otherId: string
  ): Promise<RelationshipState> {
    return this.executeQuery(async () => {
      const result = await sql<{
        viewer_follows: boolean;
        follows_viewer: boolean;
        viewer_blocked: boolean;
        blocked_viewer: boolean;
      }>`
        SELECT
          EXISTS (SELECT 1 FROM follows
                   WHERE follower_id = ${viewerId} AND following_id = ${otherId}) AS viewer_follows,
          EXISTS (SELECT 1 FROM follows
                   WHERE follower_id = ${otherId} AND following_id = ${viewerId}) AS follows_viewer,
          EXISTS (SELECT 1 FROM user_blocks
                   WHERE blocker_id = ${viewerId} AND blocked_id = ${otherId}) AS viewer_blocked,
          EXISTS (SELECT 1 FROM user_blocks
                   WHERE blocker_id = ${otherId} AND blocked_id = ${viewerId}) AS blocked_viewer
      `.execute(this.db);

      const row = result.rows[0];

      return {
        viewerFollows: row?.viewer_follows === true,
        followsViewer: row?.follows_viewer === true,
        viewerBlocked: row?.viewer_blocked === true,
        blockedViewer: row?.blocked_viewer === true,
      };
    }, "relationship");
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    await this.executeQuery(async () => {
      await this.db
        .insertInto("follows")
        .values({ follower_id: followerId, following_id: followingId })
        // Idempotent by primary key rather than by a read-then-write, so a
        // double-tapped button cannot produce two rows or a 500.
        .onConflict((oc) => oc.columns(["follower_id", "following_id"]).doNothing())
        .execute();
    }, "follow");
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    await this.executeQuery(async () => {
      await this.db
        .deleteFrom("follows")
        .where("follower_id", "=", followerId)
        .where("following_id", "=", followingId)
        .execute();
    }, "unfollow");
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    await this.executeQuery(async () => {
      await this.db.transaction().execute(async (trx) => {
        await trx
          .insertInto("user_blocks")
          .values({ blocker_id: blockerId, blocked_id: blockedId })
          .onConflict((oc) =>
            oc.columns(["blocker_id", "blocked_id"]).doNothing()
          )
          .execute();

        // Both directions, in the same transaction as the block. A block that
        // left the blocked user still following would keep feeding them the
        // blocker's saves.
        await trx
          .deleteFrom("follows")
          .where((eb) =>
            eb.or([
              eb.and([
                eb("follower_id", "=", blockerId),
                eb("following_id", "=", blockedId),
              ]),
              eb.and([
                eb("follower_id", "=", blockedId),
                eb("following_id", "=", blockerId),
              ]),
            ])
          )
          .execute();
      });
    }, "block");
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.executeQuery(async () => {
      await this.db
        .deleteFrom("user_blocks")
        .where("blocker_id", "=", blockerId)
        .where("blocked_id", "=", blockedId)
        .execute();
    }, "unblock");
  }

  async listFollowers(
    userId: string,
    limit: number,
    cursor?: SocialKeyset | null
  ): Promise<PublicProfileRow[]> {
    return this.executeQuery(async () => {
      let query = this.db
        .selectFrom("follows")
        .innerJoin("profiles", "profiles.id", "follows.follower_id")
        .select([
          "profiles.id as id",
          "profiles.handle as handle",
          "profiles.name as name",
          "profiles.picture_url as picture_url",
          "profiles.created_at as created_at",
        ])
        .where("follows.following_id", "=", userId)
        // Newest follower first, with the edge's id as the tiebreaker so two
        // follows in the same millisecond cannot swap places between pages.
        .orderBy("follows.created_at", "desc")
        .orderBy("profiles.id", "desc")
        .limit(limit);

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb("follows.created_at", "<", cursor.createdAt),
            eb.and([
              eb("follows.created_at", "=", cursor.createdAt),
              eb("profiles.id", "<", cursor.id),
            ]),
          ])
        );
      }

      return await query.execute();
    }, "listFollowers");
  }

  async listFollowing(
    userId: string,
    limit: number,
    cursor?: SocialKeyset | null
  ): Promise<PublicProfileRow[]> {
    return this.executeQuery(async () => {
      let query = this.db
        .selectFrom("follows")
        .innerJoin("profiles", "profiles.id", "follows.following_id")
        .select([
          "profiles.id as id",
          "profiles.handle as handle",
          "profiles.name as name",
          "profiles.picture_url as picture_url",
          "profiles.created_at as created_at",
        ])
        .where("follows.follower_id", "=", userId)
        .orderBy("follows.created_at", "desc")
        .orderBy("profiles.id", "desc")
        .limit(limit);

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb("follows.created_at", "<", cursor.createdAt),
            eb.and([
              eb("follows.created_at", "=", cursor.createdAt),
              eb("profiles.id", "<", cursor.id),
            ]),
          ])
        );
      }

      return await query.execute();
    }, "listFollowing");
  }

  async listPublicSaves(
    userId: string,
    limit: number,
    cursor?: SocialKeyset | null
  ): Promise<BookmarkRow[]> {
    return this.executeQuery(async () => {
      let query = this.db
        .selectFrom("bookmarks")
        .selectAll()
        .where("user_id", "=", userId)
        // The three conditions that make a save public. Archived rows drop out
        // because archiving is how a user takes something out of circulation
        // without deleting it.
        .where("is_public", "=", true)
        .where("is_archived", "=", false)
        .orderBy("created_at", "desc")
        .orderBy("id", "desc")
        .limit(limit);

      if (cursor) {
        query = query.where((eb) =>
          eb.or([
            eb("created_at", "<", cursor.createdAt),
            eb.and([
              eb("created_at", "=", cursor.createdAt),
              eb("id", "<", cursor.id),
            ]),
          ])
        );
      }

      return await query.execute();
    }, "listPublicSaves");
  }
}
