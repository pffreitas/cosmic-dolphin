import { Kysely } from "kysely";
import { BaseRepository } from "./base.repository";
import { Database, Profile, ProfileUpdate } from "../database/schema";

/**
 * Postgres' unique violation. The handle write races by definition — two
 * people can be typing the same handle into the claim prompt at the same
 * moment — and a check-then-write cannot close that window. The constraint
 * can, so the repository lets it, and turns the violation into an answer
 * rather than a 500.
 */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === UNIQUE_VIOLATION) return true;
  // `BaseRepository.handleError` rewraps the driver error as a plain `Error`,
  // so by the time a caller sees it the code is only in the message.
  return (
    error instanceof Error && error.message.includes(`"profiles_handle_key"`)
  );
}

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findByHandle(handle: string): Promise<Profile | null>;
  upsert(
    id: string,
    data: { name?: string; email?: string; picture_url?: string }
  ): Promise<Profile>;
  update(id: string, data: ProfileUpdate): Promise<Profile>;

  /**
   * Set the handle, or report that someone else already has it.
   *
   * Returns `null` on collision instead of throwing: "that handle is taken" is
   * something the user can act on, not an incident.
   */
  setHandle(
    id: string,
    handle: string,
    stamps: { claimedAt: Date; changedAt?: Date }
  ): Promise<Profile | null>;
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

  async findByHandle(handle: string): Promise<Profile | null> {
    return this.executeQuery(async () => {
      const result = await this.db
        .selectFrom("profiles")
        .selectAll()
        .where("handle", "=", handle)
        .executeTakeFirst();

      return result || null;
    }, "findByHandle");
  }

  async setHandle(
    id: string,
    handle: string,
    stamps: { claimedAt: Date; changedAt?: Date }
  ): Promise<Profile | null> {
    try {
      return await this.db
        .updateTable("profiles")
        .set({
          handle,
          handle_claimed_at: stamps.claimedAt,
          // Omitted rather than nulled when the handle did not actually
          // change: confirming the reserved handle unchanged must not start
          // the 30-day clock on a change the user did not make.
          ...(stamps.changedAt ? { handle_changed_at: stamps.changedAt } : {}),
          updated_at: new Date(),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      this.handleError(error, "setHandle");
    }
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
