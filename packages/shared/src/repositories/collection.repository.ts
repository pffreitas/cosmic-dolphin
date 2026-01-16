import { Kysely, sql } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  Collection,
  NewCollection,
  CollectionUpdate,
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
  createPath(userId: string, path: string[]): Promise<Collection>;
  update(id: string, data: CollectionUpdate): Promise<Collection>;
  delete(id: string): Promise<void>;
  getCollectionPath(collectionId: string): Promise<CollectionPathItem[]>;
  getCollectionsByIds(
    collectionIds: string[]
  ): Promise<Map<string, CollectionPathItem>>;
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

  async createPath(userId: string, path: string[]): Promise<Collection> {
    if (path.length === 0) {
      throw new Error("Category path cannot be empty");
    }

    let parentId: string | null = null;
    let lastCollection: Collection | null = null;

    for (const name of path) {
      // Check if this level already exists
      const existing = await this.findByNameAndParent(userId, name, parentId);

      if (existing) {
        lastCollection = existing;
        parentId = existing.id;
      } else {
        // Create the category at this level
        lastCollection = await this.create({
          name,
          user_id: userId,
          parent_id: parentId,
        });
        parentId = lastCollection.id;
      }
    }

    return lastCollection!;
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
}
