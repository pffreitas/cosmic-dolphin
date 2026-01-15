import { Kysely } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  Collection,
  NewCollection,
  CollectionUpdate,
} from "../database/schema";

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
}
