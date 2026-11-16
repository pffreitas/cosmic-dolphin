import { Kysely, sql } from "kysely";
import { Database } from "../database/schema";

/** How long a read message stays hidden. The ceiling for one processing run. */
export const QUEUE_VISIBILITY_TIMEOUT_SECONDS = 300;

export interface PgmqMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: Date;
  vt: Date;
  message: unknown;
}

export interface PgmqRepository {
  send(queue: string, payload: object, delaySeconds?: number): Promise<number>;
  read(
    queue: string,
    visibilitySeconds: number,
    quantity: number
  ): Promise<PgmqMessage[]>;
  delete(queue: string, msgId: number): Promise<void>;
  archive(queue: string, msgId: number): Promise<void>;
  setVisibility(queue: string, msgId: number, seconds: number): Promise<void>;
}

interface RawMessage {
  msg_id: string | number;
  read_ct: string | number;
  enqueued_at: Date | string;
  vt: Date | string;
  message: unknown;
}

/**
 * pgmq over SQL. Pass the `Kysely` instance or a transaction: a `send` made on a
 * transaction commits or rolls back with it. Only the forms present in both
 * pgmq 1.4.4 (production) and 1.5.1 (local) are called, and no session state is
 * used, because production connects through a transaction pooler.
 */
export class PgmqRepositoryImpl implements PgmqRepository {
  constructor(private db: Kysely<Database>) {}

  async send(
    queue: string,
    payload: object,
    delaySeconds: number = 0
  ): Promise<number> {
    const result = await sql<{ id: string | number }>`
      SELECT pgmq.send(${queue}::text, ${JSON.stringify(payload)}::jsonb, ${delaySeconds}::integer) AS id
    `.execute(this.db);
    return Number(result.rows[0].id);
  }

  async read(
    queue: string,
    visibilitySeconds: number,
    quantity: number
  ): Promise<PgmqMessage[]> {
    const result = await sql<RawMessage>`
      SELECT msg_id, read_ct, enqueued_at, vt, message
      FROM pgmq.read(${queue}::text, ${visibilitySeconds}::integer, ${quantity}::integer)
    `.execute(this.db);
    return result.rows.map((row) => ({
      msg_id: Number(row.msg_id),
      read_ct: Number(row.read_ct),
      enqueued_at: new Date(row.enqueued_at),
      vt: new Date(row.vt),
      message: row.message,
    }));
  }

  async delete(queue: string, msgId: number): Promise<void> {
    await sql`SELECT pgmq.delete(${queue}::text, ${msgId}::bigint)`.execute(this.db);
  }

  async archive(queue: string, msgId: number): Promise<void> {
    await sql`SELECT pgmq.archive(${queue}::text, ${msgId}::bigint)`.execute(this.db);
  }

  async setVisibility(queue: string, msgId: number, seconds: number): Promise<void> {
    await sql`SELECT pgmq.set_vt(${queue}::text, ${msgId}::bigint, ${seconds}::integer)`.execute(this.db);
  }
}
