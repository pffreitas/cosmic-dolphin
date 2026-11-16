import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { sql } from "kysely";
import { PgmqRepositoryImpl } from "../../repositories/pgmq.repository";
import { getTestDatabase } from "../../test-utils/database";

// An existing local queue nothing else writes to; creating queues needs more than DML.
const QUEUE = "tasks";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("PgmqRepository", () => {
  const db = getTestDatabase();
  const repository = new PgmqRepositoryImpl(db);

  const clean = async () => {
    await sql`DELETE FROM pgmq.q_tasks`.execute(db);
    await sql`DELETE FROM pgmq.a_tasks`.execute(db);
  };

  beforeAll(clean);
  afterAll(clean);

  it("send then read round-trips a JSON object and counts deliveries", async () => {
    const payload = { type: "t", data: { a: 1, nested: ["x"] } };
    const id = await repository.send(QUEUE, payload);
    expect(typeof id).toBe("number");

    const [first] = await repository.read(QUEUE, 0, 10);
    expect(first.msg_id).toBe(id);
    expect(first.message).toEqual(payload);
    expect(typeof first.message).toBe("object");
    expect(first.read_ct).toBe(1);
    expect(first.enqueued_at).toBeInstanceOf(Date);
    expect(first.vt).toBeInstanceOf(Date);

    const [second] = await repository.read(QUEUE, 0, 10);
    expect(second.msg_id).toBe(id);
    expect(second.read_ct).toBe(2);
    await repository.delete(QUEUE, id);
  });

  it("visibility hides a message until it expires", async () => {
    const id = await repository.send(QUEUE, { n: 1 });
    expect(await repository.read(QUEUE, 1, 10)).toHaveLength(1);
    expect(await repository.read(QUEUE, 1, 10)).toHaveLength(0);
    await sleep(1200);
    const again = await repository.read(QUEUE, 1, 10);
    expect(again).toHaveLength(1);
    expect(again[0].read_ct).toBe(2);
    await repository.delete(QUEUE, id);
  });

  it("delete archive and setVisibility behave as pgmq documents", async () => {
    const deleted = await repository.send(QUEUE, { n: "del" });
    await repository.delete(QUEUE, deleted);
    expect(await repository.read(QUEUE, 0, 10)).toHaveLength(0);

    const archived = await repository.send(QUEUE, { n: "arc" });
    await repository.archive(QUEUE, archived);
    expect(await repository.read(QUEUE, 0, 10)).toHaveLength(0);
    const rows = await sql<{ msg_id: string }>`
      SELECT msg_id FROM pgmq.a_tasks WHERE msg_id = ${archived}`.execute(db);
    expect(rows.rows).toHaveLength(1);

    const hidden = await repository.send(QUEUE, { n: "vt" });
    expect(await repository.read(QUEUE, 300, 10)).toHaveLength(1);
    expect(await repository.read(QUEUE, 300, 10)).toHaveLength(0);
    await repository.setVisibility(QUEUE, hidden, 0);
    expect(await repository.read(QUEUE, 0, 10)).toHaveLength(1);
    await repository.delete(QUEUE, hidden);
  });

  it("send works inside a transaction and rolls back with it", async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await new PgmqRepositoryImpl(trx).send(QUEUE, { n: "rolled" });
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");
    expect(await repository.read(QUEUE, 0, 10)).toHaveLength(0);
  });
});
