import { sql, type Kysely } from "kysely";
import type { Database } from "../database/schema";

export class ShareKeyRepositoryImpl {
  constructor(private readonly db: Kysely<Database>) {}
  async issue(userId: string, deviceId: string, keyHash: string) {
    return this.db.transaction().execute(async transaction => {
      // Lock the installation even on its first issue (there is no row to lock yet).
      // The transaction makes revoke+insert atomic; the partial index is the backstop.
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId, deviceId])}, 0))`.execute(transaction);
      await transaction.updateTable("share_keys").set({ revoked_at: new Date() })
        .where("user_id", "=", userId).where("device_id", "=", deviceId).where("revoked_at", "is", null).execute();
      return transaction.insertInto("share_keys").values({ user_id: userId, device_id: deviceId, key_hash: keyHash }).returning("id").executeTakeFirstOrThrow();
    });
  }
  async findByHash(keyHash: string) {
    return this.db.selectFrom("share_keys").select(["id", "user_id", "revoked_at"]).where("key_hash", "=", keyHash).executeTakeFirst();
  }
  async revoke(id: string, userId: string) {
    return this.db.updateTable("share_keys").set({ revoked_at: new Date() }).where("id", "=", id).where("user_id", "=", userId).where("revoked_at", "is", null).returning("id").executeTakeFirst();
  }
}
