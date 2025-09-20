import { Kysely } from 'kysely';
import { BaseRepository } from './base.repository';
import { Database, Collection, NewCollection, CollectionUpdate } from '../database/schema';

export interface CollectionRepository {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  create(data: NewCollection): Promise<Collection>;
  update(id: string, data: CollectionUpdate): Promise<Collection>;
  delete(id: string): Promise<void>;
}

export class CollectionRepositoryImpl extends BaseRepository implements CollectionRepository {
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findByIdAndUser(id: string, userId: string): Promise<Collection | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom('collections')
        .selectAll()
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      return result || null;
    }, 'findByIdAndUser');
  }

  async findByUser(userId: string): Promise<Collection[]> {
    return this.executeQuery(async () => {
      return await this.db
        .selectFrom('collections')
        .selectAll()
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();
    }, 'findByUser');
  }

  async create(data: NewCollection): Promise<Collection> {
    return this.executeQuery(async () => {
      const result = await this.db
        .insertInto('collections')
        .values(data)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, 'create');
  }

  async update(id: string, data: CollectionUpdate): Promise<Collection> {
    return this.executeQuery(async () => {
      const result = await this.db
        .updateTable('collections')
        .set(data)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return result;
    }, 'update');
  }

  async delete(id: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db
        .deleteFrom('collections')
        .where('id', '=', id)
        .execute();
    }, 'delete');
  }
}