import { createHash, randomBytes } from "node:crypto";
import { ShareKeyRepositoryImpl } from "../repositories/share-key.repository";

export class ShareKeyServiceImpl {
  constructor(private readonly repository: ShareKeyRepositoryImpl) {}
  async issue(userId: string, deviceId: string) {
    const key = `cdsk_${randomBytes(32).toString("base64url")}`;
    const { id } = await this.repository.issue(userId, deviceId, this.hash(key));
    console.info({ user_id: userId, key_id: id }, "Share key issued");
    return { id, key };
  }
  async authenticate(key: string) {
    const row = /^cdsk_[A-Za-z0-9_-]{43}$/.test(key) ? await this.repository.findByHash(this.hash(key)) : undefined;
    if (!row || row.revoked_at) {
      console.info({ user_id: row?.user_id, key_id: row?.id }, "Share key rejected");
      return undefined;
    }
    return { id: row.id, user_id: row.user_id };
  }
  async revoke(id: string, userId: string) {
    if (await this.repository.revoke(id, userId)) console.info({ user_id: userId, key_id: id }, "Share key revoked");
  }
  private hash(key: string) { return createHash("sha256").update(key).digest("hex"); }
}
