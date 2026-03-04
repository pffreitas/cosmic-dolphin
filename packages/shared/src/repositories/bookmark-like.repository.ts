import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/schema";

export interface BookmarkLikeRepository {
  like(userId: string, bookmarkId: string): Promise<void>;
  unlike(userId: string, bookmarkId: string): Promise<void>;
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

  async like(userId: string, bookmarkId: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db.transaction().execute(async (trx) => {
        const result = await trx
          .insertInto("bookmark_likes")
          .values({ user_id: userId, bookmark_id: bookmarkId })
          .onConflict((oc) => oc.columns(["user_id", "bookmark_id"]).doNothing())
          .executeTakeFirst();

        const rowsInserted = Number(result.numInsertedOrUpdatedRows ?? 0);
        if (rowsInserted > 0) {
          await trx
            .updateTable("bookmarks")
            .set({ like_count: sql`like_count + 1` })
            .where("id", "=", bookmarkId)
            .execute();
        }
      });
    }, "like");
  }

  async unlike(userId: string, bookmarkId: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db.transaction().execute(async (trx) => {
        const result = await trx
          .deleteFrom("bookmark_likes")
          .where("user_id", "=", userId)
          .where("bookmark_id", "=", bookmarkId)
          .executeTakeFirst();

        const rowsDeleted = Number(result.numDeletedRows ?? 0);
        if (rowsDeleted > 0) {
          await trx
            .updateTable("bookmarks")
            .set({ like_count: sql`GREATEST(like_count - 1, 0)` })
            .where("id", "=", bookmarkId)
            .execute();
        }
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
