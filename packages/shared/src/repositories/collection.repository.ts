import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  Collection,
  NewCollection,
  CollectionUpdate,
  CollectionSuggestionRow,
  CollectionSuggestionStatus,
} from "../database/schema";
import { CollectionPathItem } from "../types";

export interface CollectionRepository {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  findByNameAndParent(
    userId: string,
    name: string,
    parentId: string | null
  ): Promise<Collection | null>;
  findTreeByUser(userId: string): Promise<Collection[]>;
  create(data: NewCollection): Promise<Collection>;
  update(id: string, data: CollectionUpdate): Promise<Collection>;
  delete(id: string): Promise<void>;
  getCollectionPath(collectionId: string): Promise<CollectionPathItem[]>;
  getCollectionsByIds(
    collectionIds: string[]
  ): Promise<Map<string, CollectionPathItem>>;

  // Collection suggestions — proposals the pipeline accumulates and the user
  // decides on. Nothing here creates a collection.
  recordSuggestionSupport(
    userId: string,
    name: string,
    parentId: string | null,
    bookmarkId: string
  ): Promise<CollectionSuggestionRow | null>;
  findSuggestionsByUser(
    userId: string,
    options?: { status?: CollectionSuggestionStatus; minSupport?: number }
  ): Promise<CollectionSuggestionRow[]>;
  findSuggestionByIdAndUser(
    id: string,
    userId: string
  ): Promise<CollectionSuggestionRow | null>;
  updateSuggestionStatus(
    id: string,
    userId: string,
    status: CollectionSuggestionStatus,
    dismissedUntil?: Date | null
  ): Promise<CollectionSuggestionRow | null>;
}

export class CollectionRepositoryImpl
  extends BaseRepository
  implements CollectionRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findByIdAndUser(
    id: string,
    userId: string
  ): Promise<Collection | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("collections")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return result || null;
    }, "findByIdAndUser");
  }

  async findByUser(userId: string): Promise<Collection[]> {
    return this.executeQuery(async () => {
      return await this.db
        .selectFrom("collections")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .execute();
    }, "findByUser");
  }

  async findByNameAndParent(
    userId: string,
    name: string,
    parentId: string | null
  ): Promise<Collection | null> {
    return this.executeQuery(async () => {
      let query = this.db
        .selectFrom("collections")
        .selectAll()
        .where("user_id", "=", userId)
        .where("name", "=", name);

      if (parentId === null) {
        query = query.where("parent_id", "is", null);
      } else {
        query = query.where("parent_id", "=", parentId);
      }

      const result = await query.executeTakeFirst();
      return result || null;
    }, "findByNameAndParent");
  }

  async findTreeByUser(userId: string): Promise<Collection[]> {
    return this.executeQuery(async () => {
      return await this.db
        .selectFrom("collections")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("name", "asc")
        .execute();
    }, "findTreeByUser");
  }

  async create(data: NewCollection): Promise<Collection> {
    return this.executeQuery(async () => {
      const result = await this.db
        .insertInto("collections")
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, "create");
  }

  async update(id: string, data: CollectionUpdate): Promise<Collection> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("collections")
        .set(data)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, "update");
  }

  async delete(id: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db.deleteFrom("collections").where("id", "=", id).execute();
    }, "delete");
  }

  async getCollectionPath(collectionId: string): Promise<CollectionPathItem[]> {
    return this.executeQuery(async () => {
      // Use recursive CTE to traverse from child to root
      const result = await sql<{ id: string; name: string; depth: number }>`
        WITH RECURSIVE collection_path AS (
          -- Base case: start with the given collection
          SELECT id, name, parent_id, 0 as depth
          FROM collections
          WHERE id = ${collectionId}
          
          UNION ALL
          
          -- Recursive case: get parent collection
          SELECT c.id, c.name, c.parent_id, cp.depth + 1
          FROM collections c
          INNER JOIN collection_path cp ON c.id = cp.parent_id
        )
        SELECT id, name, depth
        FROM collection_path
        ORDER BY depth DESC
      `.execute(this.db);

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
      }));
    }, "getCollectionPath");
  }

  async getCollectionsByIds(
    collectionIds: string[]
  ): Promise<Map<string, CollectionPathItem>> {
    if (collectionIds.length === 0) {
      return new Map();
    }

    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("collections")
        .select(["id", "name"])
        .where(
          "id",
          "in",
          collectionIds.map((id) => id)
        )
        .execute();

      const collectionsMap = new Map<string, CollectionPathItem>();
      for (const row of result) {
        collectionsMap.set(row.id, {
          id: row.id,
          name: row.name,
        });
      }

      return collectionsMap;
    }, "getCollectionsByIds");
  }

  /**
   * Add one bookmark's vote to a proposed collection, opening the proposal if
   * this is the first vote.
   *
   * Returns `null` when the user has already decided about this name — an
   * accepted proposal (the collection exists; the caller should have matched it
   * instead) or a dismissal that has not yet expired. A dismissal is an answer,
   * and re-asking on the next run is exactly the fighting this deliverable
   * exists to stop.
   *
   * The upsert is a single statement so two workers filing two bookmarks into
   * the same proposal at the same time produce one row with two supporters
   * rather than one row and a unique violation. The conflict target mirrors
   * `idx_collection_suggestions_pending_unique`.
   */
  async recordSuggestionSupport(
    userId: string,
    name: string,
    parentId: string | null,
    bookmarkId: string
  ): Promise<CollectionSuggestionRow | null> {
    return this.executeQuery(async () => {
      const decided = await this.db
        .selectFrom("collection_suggestions")
        .selectAll()
        .where("user_id", "=", userId)
        .where(sql<boolean>`lower(name) = lower(${name})`)
        .where((eb) =>
          parentId === null
            ? eb("parent_id", "is", null)
            : eb("parent_id", "=", parentId)
        )
        .where("status", "!=", "pending")
        .execute();

      const suppressed = decided.some(
        (row) =>
          row.status === "accepted" ||
          (row.status === "dismissed" &&
            (row.dismissed_until === null ||
              new Date(row.dismissed_until) > new Date()))
      );
      if (suppressed) return null;

      const result = await sql<CollectionSuggestionRow>`
        INSERT INTO collection_suggestions (user_id, name, parent_id, bookmark_ids)
        VALUES (${userId}, ${name}, ${parentId}, ARRAY[${bookmarkId}]::uuid[])
        ON CONFLICT (
          user_id,
          lower(name),
          COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) WHERE status = 'pending'
        DO UPDATE SET bookmark_ids = (
          SELECT COALESCE(array_agg(DISTINCT supporter), ARRAY[]::uuid[])
          FROM unnest(
            collection_suggestions.bookmark_ids || EXCLUDED.bookmark_ids
          ) AS supporter
        )
        RETURNING *
      `.execute(this.db);

      return result.rows[0] ?? null;
    }, "recordSuggestionSupport");
  }

  async findSuggestionsByUser(
    userId: string,
    options: { status?: CollectionSuggestionStatus; minSupport?: number } = {}
  ): Promise<CollectionSuggestionRow[]> {
    return this.executeQuery(async () => {
      let query = this.db
        .selectFrom("collection_suggestions")
        .selectAll()
        .where("user_id", "=", userId);

      if (options.status) {
        query = query.where("status", "=", options.status);
      }

      if (options.minSupport !== undefined) {
        query = query.where(
          sql<boolean>`coalesce(array_length(bookmark_ids, 1), 0) >= ${options.minSupport}`
        );
      }

      return await query.orderBy("created_at", "desc").execute();
    }, "findSuggestionsByUser");
  }

  async findSuggestionByIdAndUser(
    id: string,
    userId: string
  ): Promise<CollectionSuggestionRow | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("collection_suggestions")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      return result ?? null;
    }, "findSuggestionByIdAndUser");
  }

  async updateSuggestionStatus(
    id: string,
    userId: string,
    status: CollectionSuggestionStatus,
    dismissedUntil: Date | null = null
  ): Promise<CollectionSuggestionRow | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable("collection_suggestions")
        .set({ status, dismissed_until: dismissedUntil })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .returningAll()
        .executeTakeFirst();

      return result ?? null;
    }, "updateSuggestionStatus");
  }
}
