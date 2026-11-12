import { sql } from "kysely";
import { randomUUID, createHash } from "node:crypto";
import { getTestDatabase } from "../../test-utils/database";
import { ShareKeyRepositoryImpl } from "../../repositories/share-key.repository";
import { ShareKeyServiceImpl } from "../../services/share-key.service";
const db = getTestDatabase();
const service = new ShareKeyServiceImpl(new ShareKeyRepositoryImpl(db));
let owner: string;
beforeEach(async () => {
  owner = randomUUID();
  await sql`INSERT INTO auth.users(id,email) VALUES (${owner}::uuid, ${owner + "@example.invalid"})`.execute(db);
});
it("atomically rotates concurrent same-device issues and preserves unrelated installations", async () => {
  const other = await service.issue(owner, "other-device");
  const previous = await service.issue(owner, "same-device");
  const issued = await Promise.all(Array.from({ length: 8 }, () => service.issue(owner, "same-device")));
  expect(await service.authenticate(previous.key)).toBeUndefined();
  const active = await Promise.all(issued.map(item => service.authenticate(item.key)));
  expect(active.filter(Boolean)).toHaveLength(1);
  expect(await service.authenticate(other.key)).toMatchObject({ id: other.id, user_id: owner });
});
it("stores only SHA-256, enforces active uniqueness and owner RLS, and cascades account deletion", async () => {
  const issued = await service.issue(owner, "hash-device");
  const row = await db.selectFrom("share_keys").selectAll().where("id", "=", issued.id).executeTakeFirstOrThrow();
  expect(row.key_hash).toBe(createHash("sha256").update(issued.key).digest("hex"));
  expect(JSON.stringify(row)).not.toContain(issued.key);
  await expect(db.insertInto("share_keys").values({ user_id: owner, device_id: "hash-device", key_hash: "a".repeat(64) }).execute()).rejects.toThrow(/share_keys_active_device/);
  await db.transaction().execute(async trx => {
    await sql`SET LOCAL ROLE authenticated`.execute(trx);
    await sql`SELECT set_config('request.jwt.claim.sub', ${randomUUID()}, true)`.execute(trx);
    expect(await trx.selectFrom("share_keys").selectAll().execute()).toEqual([]);
    await sql`SELECT set_config('request.jwt.claim.sub', ${owner}, true)`.execute(trx);
    expect(await trx.selectFrom("share_keys").select("id").execute()).toEqual([{ id: issued.id }]);
  });
  await sql`DELETE FROM auth.users WHERE id = ${owner}::uuid`.execute(db);
  expect(await service.authenticate(issued.key)).toBeUndefined();
});
it("revokes only the owner's idempotent key while preserving other devices", async () => {
  const key = await service.issue(owner, "owner-revoke");
  const other = await service.issue(owner, "other-revoke");
  await service.revoke(key.id, randomUUID());
  expect(await service.authenticate(key.key)).toMatchObject({ id: key.id });
  await service.revoke(key.id, owner);
  await service.revoke(key.id, owner);
  await service.revoke(randomUUID(), owner);
  expect(await service.authenticate(key.key)).toBeUndefined();
  expect(await service.authenticate(other.key)).toMatchObject({ id: other.id });
});
it("logs issue, revoke and rejection with ids and never includes the credential", async () => {
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  try {
    const issued = await service.issue(owner, "logging");
    await service.revoke(issued.id, owner);
    await service.authenticate(issued.key);
    expect(log.mock.calls.map(call => call[1])).toEqual(["Share key issued", "Share key revoked", "Share key rejected"]);
    for (const call of log.mock.calls) expect(call[0]).toEqual({ user_id: owner, key_id: issued.id });
    expect(JSON.stringify(log.mock.calls)).not.toContain(issued.key);
  } finally { log.mockRestore(); }
});
