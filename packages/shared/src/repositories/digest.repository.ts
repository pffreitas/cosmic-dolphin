import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import { Database, FeedDigestRow } from "../database/schema";
import { DigestKeyPoint, DigestSource } from "../types";

/**
 * Everything the digest resource reads and writes — docs/functional-spec/05-feed.md
 * § Digests.
 *
 * Two callers, one table. The **generator** (worker) reads the raw material of
 * a cluster and writes a digest; the **API** reads one digest, likes it, and
 * shares it. The ranker's own candidate query lives in `feed.repository.ts`
 * with the rest of what the ranker reads, and calls `mapDigestSources` from
 * here so the two cannot drift on how a source is shaped.
 *
 * The provenance rule is enforced in three places and this file is one of
 * them: `create` refuses a digest with fewer than three sources before the
 * insert can, so the failure names the actual problem rather than surfacing as
 * a CHECK violation.
 */

/** A save inside the clustering window, with its mean embedding. */
export interface DigestCandidateSave {
  bookmarkId: string;
  title: string;
  url: string;
  tags: string[];
  createdAt: Date;
  summary: string | null;
  /**
   * The mean of the bookmark's chunk embeddings. Present only for saves the
   * pipeline has embedded — a save with no embedding is not clusterable and is
   * left out of the window rather than given a neutral vector, which would
   * quietly pull every cluster towards the origin.
   */
  embedding: number[];
}

/** One row of the `Built from` provenance line, before it becomes a `DigestSource`. */
export interface DigestSourceRow {
  id: string;
  title: string | null;
  source_url: string;
  metadata: any;
}

export interface CreateDigestInput {
  userId: string;
  title: string;
  summary: string;
  keyPoints: DigestKeyPoint[];
  sourceBookmarkIds: string[];
  coherence: number;
  modelId: string | null;
  windowStart: Date;
  windowEnd: Date;
}

export interface DigestRepository {
  /** One digest by id, whoever owns it. Visibility is the service's decision. */
  findById(digestId: string): Promise<FeedDigestRow | null>;

  /** The source bookmarks of a digest, in the order the digest stored them. */
  findSources(bookmarkIds: string[]): Promise<DigestSourceRow[]>;

  /** Has this viewer liked these digests? Keyed by digest id. */
  findLikedBy(userId: string, digestIds: string[]): Promise<Set<string>>;

  create(input: CreateDigestInput): Promise<FeedDigestRow>;

  like(userId: string, digestId: string): Promise<number>;
  unlike(userId: string, digestId: string): Promise<number>;

  /** Publish. Idempotent, and the slug survives an unshare. */
  share(digestId: string, userId: string): Promise<FeedDigestRow | null>;
  unshare(digestId: string, userId: string): Promise<FeedDigestRow | null>;

  /**
   * The people whose libraries have moved enough to be worth clustering.
   *
   * The scheduler asks this and enqueues one message per answer — it never
   * walks the whole user table, because a digest job for someone who has saved
   * nothing in a fortnight is a model call with a known-empty result.
   */
  findUsersDueForDigest(input: {
    since: Date;
    minSaves: number;
    /** Users who already got a digest after this instant are skipped. */
    cooldownSince: Date;
    limit: number;
  }): Promise<string[]>;

  /**
   * Has this user had a digest since `since`?
   *
   * The generator's own idempotence check. Two worker replicas ticking their
   * schedulers in the same second both see nobody in cooldown and both
   * enqueue; without this, that is two digests. The queue is at-least-once by
   * design, so the job has to be the thing that refuses.
   */
  hasRecentDigest(userId: string, since: Date): Promise<boolean>;

  /** The clustering window: embedded saves from the last n days. */
  findCandidateSaves(
    userId: string,
    since: Date,
    limit: number
  ): Promise<DigestCandidateSave[]>;

  /**
   * Bookmarks already used by a recent digest.
   *
   * A cluster is stable across a fortnight, so without this the same four
   * saves produce the same observation every night. Sources are not reused
   * inside the cooldown; a genuinely new cluster is a genuinely new digest.
   */
  findRecentlyDigestedBookmarkIds(
    userId: string,
    since: Date
  ): Promise<Set<string>>;
}

export class DigestRepositoryImpl
  extends BaseRepository
  implements DigestRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findById(digestId: string): Promise<FeedDigestRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("feed_digests")
        .selectAll()
        .where("id", "=", digestId)
        .executeTakeFirst();

      return row ?? null;
    }, "findById");
  }

  async findSources(bookmarkIds: string[]): Promise<DigestSourceRow[]> {
    if (bookmarkIds.length === 0) return [];

    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("bookmarks")
        .select(["id", "title", "source_url", "metadata"])
        .where("id", "in", bookmarkIds)
        .execute();

      return rows as DigestSourceRow[];
    }, "findSources");
  }

  async findLikedBy(userId: string, digestIds: string[]): Promise<Set<string>> {
    if (digestIds.length === 0) return new Set();

    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("feed_digest_likes")
        .select("digest_id")
        .where("user_id", "=", userId)
        .where("digest_id", "in", digestIds)
        .execute();

      return new Set(rows.map((row) => row.digest_id));
    }, "findLikedBy");
  }

  async create(input: CreateDigestInput): Promise<FeedDigestRow> {
    // Checked here as well as in SQL. The CHECK constraint is the guarantee;
    // this is the error message, and a generator bug should read
    // "a digest needs at least 3 sources" rather than a constraint name.
    if (input.sourceBookmarkIds.length < 3) {
      throw new Error(
        `A digest needs at least 3 source bookmarks, got ${input.sourceBookmarkIds.length}`
      );
    }

    return this.executeQuery(async () => {
      const row = await this.db
        .insertInto("feed_digests")
        .values({
          user_id: input.userId,
          title: input.title,
          summary: input.summary,
          key_points: JSON.stringify(input.keyPoints),
          source_bookmark_ids: input.sourceBookmarkIds,
          coherence: input.coherence,
          model_id: input.modelId,
          window_start: input.windowStart,
          window_end: input.windowEnd,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return row;
    }, "create");
  }

  async like(userId: string, digestId: string): Promise<number> {
    return this.executeQuery(async () => {
      // The count is maintained by trigger, so the insert is the whole write
      // and a second like is a no-op rather than a double count.
      await this.db
        .insertInto("feed_digest_likes")
        .values({ user_id: userId, digest_id: digestId })
        .onConflict((oc) => oc.columns(["digest_id", "user_id"]).doNothing())
        .execute();

      return this.likeCount(digestId);
    }, "like");
  }

  async unlike(userId: string, digestId: string): Promise<number> {
    return this.executeQuery(async () => {
      await this.db
        .deleteFrom("feed_digest_likes")
        .where("user_id", "=", userId)
        .where("digest_id", "=", digestId)
        .execute();

      return this.likeCount(digestId);
    }, "unlike");
  }

  private async likeCount(digestId: string): Promise<number> {
    const row = await this.db
      .selectFrom("feed_digests")
      .select("like_count")
      .where("id", "=", digestId)
      .executeTakeFirst();

    return row?.like_count ?? 0;
  }

  async share(digestId: string, userId: string): Promise<FeedDigestRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .updateTable("feed_digests")
        .set({
          is_public: true,
          // Generated once and kept: a slug that changed on every re-share
          // would break links people already have.
          share_slug: sql<string>`COALESCE(share_slug, encode(gen_random_bytes(8), 'hex'))`,
          updated_at: sql`now()`,
        })
        .where("id", "=", digestId)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return row ?? null;
    }, "share");
  }

  async unshare(
    digestId: string,
    userId: string
  ): Promise<FeedDigestRow | null> {
    return this.executeQuery(async () => {
      const row = await this.db
        .updateTable("feed_digests")
        .set({ is_public: false, updated_at: sql`now()` })
        .where("id", "=", digestId)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return row ?? null;
    }, "unshare");
  }

  async findUsersDueForDigest(input: {
    since: Date;
    minSaves: number;
    cooldownSince: Date;
    limit: number;
  }): Promise<string[]> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("bookmarks")
        .select("user_id")
        .where("created_at", ">=", input.since)
        .where("is_archived", "=", false)
        .groupBy("user_id")
        .having(sql<number>`count(*)`, ">=", input.minSaves)
        // Nobody gets two digests inside the cooldown. The scheduler ticking
        // twice, or a redeploy replaying it, must not produce a second one.
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom("feed_digests")
                .select("feed_digests.id")
                .whereRef("feed_digests.user_id", "=", "bookmarks.user_id")
                .where("feed_digests.created_at", ">=", input.cooldownSince)
            )
          )
        )
        .limit(input.limit)
        .execute();

      return rows.map((row) => row.user_id);
    }, "findUsersDueForDigest");
  }

  async hasRecentDigest(userId: string, since: Date): Promise<boolean> {
    return this.executeQuery(async () => {
      const row = await this.db
        .selectFrom("feed_digests")
        .select("id")
        .where("user_id", "=", userId)
        .where("created_at", ">=", since)
        .limit(1)
        .executeTakeFirst();

      return row !== undefined;
    }, "hasRecentDigest");
  }

  async findCandidateSaves(
    userId: string,
    since: Date,
    limit: number
  ): Promise<DigestCandidateSave[]> {
    return this.executeQuery(async () => {
      // One mean embedding per bookmark, the same "mean of the mean" the
      // interest vector uses: every bookmark contributes one vector whatever
      // its length, so a 40-chunk essay does not outvote a 3-chunk note.
      //
      // `AS MATERIALIZED` for the same reason as in `feed.repository.ts` —
      // without it the planner may drive the join from `text_chunks` and scan
      // every embedded chunk in the instance to assemble one person's window.
      const result = await sql<{
        id: string;
        title: string | null;
        source_url: string;
        cosmic_tags: string[] | null;
        cosmic_brief_summary: string | null;
        created_at: Date;
        embedding: string;
      }>`
        WITH window_ids AS MATERIALIZED (
          SELECT id, title, source_url, cosmic_tags, cosmic_brief_summary, created_at
          FROM bookmarks
          WHERE user_id = ${userId}
            AND is_archived = false
            AND created_at >= ${since}
          ORDER BY created_at DESC
          LIMIT ${limit}
        )
        SELECT
          w.id::text AS id,
          w.title AS title,
          w.source_url AS source_url,
          w.cosmic_tags AS cosmic_tags,
          w.cosmic_brief_summary AS cosmic_brief_summary,
          w.created_at AS created_at,
          AVG(tc.embedding)::text AS embedding
        FROM window_ids w
        JOIN scraped_url_contents suc ON suc.bookmark_id = w.id
        JOIN content_chunks cc ON cc.scraped_content_id = suc.id
        JOIN text_chunks tc ON tc.chunk_id = cc.id
        WHERE tc.embedding IS NOT NULL
        GROUP BY w.id, w.title, w.source_url, w.cosmic_tags, w.cosmic_brief_summary, w.created_at
        ORDER BY w.created_at DESC
      `.execute(this.db);

      const saves: DigestCandidateSave[] = [];
      for (const row of result.rows) {
        const embedding = parseVector(row.embedding);
        // A save whose vector will not parse is dropped, not defaulted. A
        // cluster is a claim about distance; a made-up vector is a made-up
        // claim.
        if (embedding.length === 0) continue;

        saves.push({
          bookmarkId: row.id,
          title: row.title ?? row.source_url,
          url: row.source_url,
          tags: row.cosmic_tags ?? [],
          createdAt: row.created_at,
          summary: row.cosmic_brief_summary,
          embedding,
        });
      }

      return saves;
    }, "findCandidateSaves");
  }

  async findRecentlyDigestedBookmarkIds(
    userId: string,
    since: Date
  ): Promise<Set<string>> {
    return this.executeQuery(async () => {
      const rows = await this.db
        .selectFrom("feed_digests")
        .select("source_bookmark_ids")
        .where("user_id", "=", userId)
        .where("created_at", ">=", since)
        .execute();

      const used = new Set<string>();
      for (const row of rows) {
        for (const id of row.source_bookmark_ids ?? []) used.add(id);
      }
      return used;
    }, "findRecentlyDigestedBookmarkIds");
  }
}

/**
 * `"[0.1,0.2,...]"` — pgvector's text form — into numbers.
 *
 * Returns an empty array on anything it does not recognise, which the caller
 * reads as "not clusterable" and drops. A partially-parsed vector would be a
 * point in the wrong place, and a point in the wrong place is a cluster that
 * is wrong rather than absent.
 */
export function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
      ? (value as number[])
      : [];
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];

  const parts = trimmed.slice(1, -1).split(",");
  const out: number[] = [];
  for (const part of parts) {
    const numeric = Number(part);
    if (!Number.isFinite(numeric)) return [];
    out.push(numeric);
  }

  return out;
}

/**
 * Source rows into `DigestSource`s, in the order the digest stored its ids.
 *
 * Order is preserved deliberately: the ids are the cluster's order, and the
 * `Built from` row shows the first few. Re-ordering them by whatever the
 * database returned would make the visible sources arbitrary.
 *
 * A source whose bookmark no longer exists is dropped rather than rendered as
 * a blank chip — the digest still names everything it was built from that is
 * still there, and a chip pointing at a 404 is worse than one fewer chip.
 */
export function mapDigestSources(
  bookmarkIds: string[],
  rows: DigestSourceRow[]
): DigestSource[] {
  const byId = new Map(rows.map((row) => [row.id, row]));

  const sources: DigestSource[] = [];
  for (const id of bookmarkIds) {
    const row = byId.get(id);
    if (!row) continue;

    const favicon = row.metadata?.openGraph?.favicon;

    sources.push({
      bookmarkId: row.id,
      title: row.title ?? row.source_url,
      url: row.source_url,
      domain: digestDomainOf(row.source_url),
      ...(typeof favicon === "string" && favicon ? { faviconUrl: favicon } : {}),
    });
  }

  return sources;
}

/** `https://every.to/x` → `every.to`. Bare host, no `www.`, never throws. */
export function digestDomainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The stored JSONB back into key points, defensively. */
export function parseKeyPoints(value: unknown): DigestKeyPoint[] {
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  if (!Array.isArray(raw)) return [];

  const points: DigestKeyPoint[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const text = (entry as { text?: unknown }).text;
    if (typeof text !== "string" || text.trim() === "") continue;

    const term = (entry as { term?: unknown }).term;
    points.push({
      text,
      ...(typeof term === "string" && term.trim() !== "" ? { term } : {}),
    });
  }

  return points;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
