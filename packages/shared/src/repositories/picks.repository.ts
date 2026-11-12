import { Kysely, sql } from "kysely";
import type { Bookmark, Database, DailyPicksRow } from "../database/schema";

export interface PickClock {
  now: Date;
  localDate: string;
  refreshesAt: Date;
  canCompute: boolean;
}

export class PicksRepositoryImpl {
  constructor(protected db: Kysely<Database>) {}

  // Tests substitute a PostgreSQL timestamptz expression at this repository
  // boundary. There is no request or client clock override.
  protected clockExpression() { return sql<Date>`now()`; }

  async clock(timeZone: string): Promise<PickClock | undefined> {
    const result = await sql<PickClock>`
      WITH clock AS (SELECT ${this.clockExpression()} AS instant),
      local AS (
        SELECT instant, instant AT TIME ZONE name AS wall, name
        FROM clock, pg_timezone_names WHERE name = ${timeZone}
      )
      SELECT instant AS now,
        (wall - interval '6 hours')::date::text AS "localDate",
        (((wall - interval '6 hours')::date + 1) + time '06:00') AT TIME ZONE name AS "refreshesAt",
        wall::time >= time '06:00' AS "canCompute"
      FROM local
    `.execute(this.db);
    return result.rows[0];
  }

  async find(userId: string, localDate: string): Promise<DailyPicksRow | undefined> {
    return this.db.selectFrom("daily_picks").selectAll().where("user_id", "=", userId).where("local_date", "=", localDate).executeTakeFirst();
  }

  async candidates(userId: string, now: Date): Promise<Bookmark[]> {
    return this.db.selectFrom("bookmarks").selectAll()
      .where("user_id", "=", userId).where("read_at", "is", null)
      .where("is_archived", "=", false).where("processing_status", "=", "completed")
      .where(eb => eb.or([eb("later_until", "is", null), eb("later_until", "<=", now)]))
      .where(eb => eb.or([eb("is_private_link", "=", false), sql<boolean>`length(btrim(coalesce(cosmic_brief_summary, ''))) > 0`]))
      .where(eb => eb.not(eb.exists(eb.selectFrom("feed_feedback").select("id")
        .whereRef("feed_feedback.bookmark_id", "=", "bookmarks.id")
        .where("feed_feedback.user_id", "=", userId).where("kind", "=", "not_interested"))))
      .orderBy("created_at", "desc").orderBy("id", "desc").limit(500).execute();
  }

  async insert(row: DailyPicksRow): Promise<boolean> {
    const result = await this.db.insertInto("daily_picks").values(row)
      .onConflict(oc => oc.columns(["user_id", "local_date"]).doNothing())
      .returning("user_id").execute();
    return result.length > 0;
  }

  async bookmarks(userId: string, ids: string[]): Promise<Bookmark[]> {
    if (!ids.length) return [];
    return this.db.selectFrom("bookmarks").selectAll().where("user_id", "=", userId).where("id", "in", ids)
      .where("is_archived", "=", false)
      .where(eb => eb.not(eb.exists(eb.selectFrom("feed_feedback").select("id")
        .whereRef("feed_feedback.bookmark_id", "=", "bookmarks.id")
        .where("feed_feedback.user_id", "=", userId).where("kind", "=", "not_interested"))))
      .execute();
  }
}
