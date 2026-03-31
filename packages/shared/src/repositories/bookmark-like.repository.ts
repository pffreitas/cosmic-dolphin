import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/schema";

export interface BookmarkLikeRepository {
  like(userId: string, bookmarkId: string): Promise<number>;
  unlike(userId: string, bookmarkId: string): Promise<number>;
  isLikedByUser(userId: string, bookmarkId: string): Promise<boolean>;
  getLikeCount(bookmarkId: string): Promise<number>;
}

export class BookmarkLikeRepositoryImpl
  extends BaseRepository
  implements BookmarkLikeRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async like(userId: string, bookmarkId: string): Promise<number> {
    return this.executeQuery(async () => {
      return this.db.transaction().execute(async (trx) => {
        const insert = await trx
          .insertInto("bookmark_likes")
          .values({ user_id: userId, bookmark_id: bookmarkId })
          .onConflict((oc) => oc.columns(["user_id", "bookmark_id"]).doNothing())
          .executeTakeFirst();

        const rowsInserted = Number(insert.numInsertedOrUpdatedRows ?? 0);
        if (rowsInserted > 0) {
          const updated = await trx
            .updateTable("bookmarks")
            .set({ like_count: sql`like_count + 1` })
            .where("id", "=", bookmarkId)
            .returning("like_count")
            .executeTakeFirst();
          return updated?.like_count ?? 0;
        }

        const current = await trx
          .selectFrom("bookmarks")
          .select("like_count")
          .where("id", "=", bookmarkId)
          .executeTakeFirst();
        return current?.like_count ?? 0;
      });
    }, "like");
  }

  async unlike(userId: string, bookmarkId: string): Promise<number> {
    return this.executeQuery(async () => {
      return this.db.transaction().execute(async (trx) => {
        const deleted = await trx
          .deleteFrom("bookmark_likes")
          .where("user_id", "=", userId)
          .where("bookmark_id", "=", bookmarkId)
          .executeTakeFirst();

        const rowsDeleted = Number(deleted.numDeletedRows ?? 0);
        if (rowsDeleted > 0) {
          const updated = await trx
            .updateTable("bookmarks")
            .set({ like_count: sql`GREATEST(like_count - 1, 0)` })
            .where("id", "=", bookmarkId)
            .returning("like_count")
            .executeTakeFirst();
          return updated?.like_count ?? 0;
        }

        const current = await trx
          .selectFrom("bookmarks")
          .select("like_count")
          .where("id", "=", bookmarkId)
          .executeTakeFirst();
        return current?.like_count ?? 0;
      });
    }, "unlike");
  }

  async isLikedByUser(userId: string, bookmarkId: string): Promise<boolean> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmark_likes")
        .select("id")
        .where("user_id", "=", userId)
        .where("bookmark_id", "=", bookmarkId)
        .executeTakeFirst();

      return !!result;
    }, "isLikedByUser");
  }

  async getLikeCount(bookmarkId: string): Promise<number> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("bookmarks")
        .select("like_count")
        .where("id", "=", bookmarkId)
        .executeTakeFirst();

      return result?.like_count ?? 0;
    }, "getLikeCount");
  }
}
