import { Kysely } from "kysely";
import { BaseRepository } from "./base.repository";
import { Database, Profile, ProfileUpdate } from "../database/schema";

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  upsert(
    id: string,
    data: { name?: string; email?: string; picture_url?: string }
  ): Promise<Profile>;
  update(id: string, data: ProfileUpdate): Promise<Profile>;
}

export class ProfileRepositoryImpl
  extends BaseRepository
  implements ProfileRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async findById(id: string): Promise<Profile | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("profiles")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      return result || null;
    }, "findById");
  }

  async upsert(
    id: string,
    data: { name?: string; email?: string; picture_url?: string }
  ): Promise<Profile> {
    return this.executeQuery(async () => {
      return await this.db
        .insertInto("profiles")
        .values({
          id,
          name: data.name ?? null,
          email: data.email ?? null,
          picture_url: data.picture_url ?? null,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: data.name !== undefined ? (data.name ?? null) : undefined,
            email: data.email !== undefined ? (data.email ?? null) : undefined,
            picture_url:
              data.picture_url !== undefined
                ? (data.picture_url ?? null)
                : undefined,
            updated_at: new Date(),
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow();
    }, "upsert");
  }

  async update(id: string, data: ProfileUpdate): Promise<Profile> {
    return this.executeQuery(async () => {
      return await this.db
        .updateTable("profiles")
        .set({ ...data, updated_at: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }, "update");
  }
}
