import { Profile, UpdateProfileRequest } from "../types";
import { ProfileRepository } from "../repositories/profile.repository";
import { Profile as ProfileRow } from "../database/schema";

/**
 * The caller's own profile, and the handle rules.
 *
 * Handles are the one field here with a policy attached. Three rules, all in
 * this file because all three are product decisions rather than storage ones:
 *
 *  - **Format.** `^[a-z0-9_]{3,30}$`, the same expression the column's CHECK
 *    constraint carries. Duplicated deliberately: the constraint is the
 *    guarantee, this is the error message.
 *  - **Once per 30 days.** From `handle_changed_at`, which is NULL until a
 *    person changes the handle — so the first change is always free, however
 *    long the reserved handle sat there.
 *  - **Claiming.** Every profile is born with a handle reserved from its email
 *    local part and `handle_claimed_at` NULL. Confirming it — with or without
 *    changing it — is what claims it. Confirming *unchanged* does not consume
 *    the 30-day allowance, because nothing changed.
 */

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;
export const HANDLE_CHANGE_INTERVAL_DAYS = 30;
const HANDLE_CHANGE_INTERVAL_MS = HANDLE_CHANGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

/** Something the caller sent is not allowed. A 400, not an incident. */
export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

/** No such profile. A 404 — the caller's own row is missing, which only happens mid-signup. */
export class ProfileNotFoundError extends Error {
  constructor() {
    super("Profile not found");
    this.name = "ProfileNotFoundError";
  }
}

/** Someone else has that handle. A 409 the user can act on by picking another. */
export class HandleUnavailableError extends Error {
  constructor(public readonly handle: string) {
    super(`The handle "${handle}" is taken.`);
    this.name = "HandleUnavailableError";
  }
}

/** The handle changed less than 30 days ago. */
export class HandleCooldownError extends Error {
  constructor(public readonly availableAt: Date) {
    super(
      `A handle can be changed once every ${HANDLE_CHANGE_INTERVAL_DAYS} days. You can change yours again on ${availableAt.toISOString().slice(0, 10)}.`
    );
    this.name = "HandleCooldownError";
  }
}

/**
 * When the handle may next change, or `null` when it may change now.
 *
 * `handleChangedAt === null` is the never-changed case and is always free.
 */
export function handleChangeAvailableAt(
  handleChangedAt: Date | null,
  now: Date = new Date()
): Date | null {
  if (!handleChangedAt) return null;

  const availableAt = new Date(
    handleChangedAt.getTime() + HANDLE_CHANGE_INTERVAL_MS
  );

  return availableAt.getTime() <= now.getTime() ? null : availableAt;
}

/**
 * The claim prompt's input, normalised before it is judged.
 *
 * Case-folding and trimming rather than refusing: a user who types `Paulo` has
 * not made a mistake worth an error message, and the column stores lowercase.
 * Everything else — spaces, dots, dashes — is refused, because silently
 * rewriting someone's chosen identity into a different string is worse than
 * telling them it is not allowed.
 */
export function normaliseHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertValidHandle(handle: string): void {
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) {
    throw new ProfileValidationError(
      `A handle is between ${HANDLE_MIN_LENGTH} and ${HANDLE_MAX_LENGTH} characters.`
    );
  }

  if (!HANDLE_PATTERN.test(handle)) {
    throw new ProfileValidationError(
      "A handle can only contain lowercase letters, numbers and underscores."
    );
  }
}

export interface ProfileService {
  findById(id: string): Promise<Profile | null>;
  findByHandle(handle: string): Promise<Profile | null>;
  upsert(
    id: string,
    data: { name?: string; email?: string; pictureUrl?: string }
  ): Promise<Profile>;
  update(
    id: string,
    data: Partial<Pick<Profile, "name" | "email" | "pictureUrl">>
  ): Promise<Profile>;

  /**
   * `PATCH /profile` — name, picture, and handle.
   *
   * Throws `ProfileValidationError` (400), `HandleUnavailableError` (409) or
   * `HandleCooldownError` (409). The route maps them; nothing above this layer
   * re-derives the rules.
   */
  updateProfile(id: string, data: UpdateProfileRequest): Promise<Profile>;
}

export class ProfileServiceImpl implements ProfileService {
  constructor(private profileRepository: ProfileRepository) {}

  async findById(id: string): Promise<Profile | null> {
    const profile = await this.profileRepository.findById(id);
    return profile ? this.mapDatabaseToProfile(profile) : null;
  }

  async findByHandle(handle: string): Promise<Profile | null> {
    const profile = await this.profileRepository.findByHandle(
      normaliseHandle(handle)
    );
    return profile ? this.mapDatabaseToProfile(profile) : null;
  }

  async upsert(
    id: string,
    data: { name?: string; email?: string; pictureUrl?: string }
  ): Promise<Profile> {
    const profile = await this.profileRepository.upsert(id, {
      name: data.name,
      email: data.email,
      picture_url: data.pictureUrl,
    });
    return this.mapDatabaseToProfile(profile);
  }

  async update(
    id: string,
    data: Partial<Pick<Profile, "name" | "email" | "pictureUrl">>
  ): Promise<Profile> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.pictureUrl !== undefined) updateData.picture_url = data.pictureUrl;

    const profile = await this.profileRepository.update(id, updateData);
    return this.mapDatabaseToProfile(profile);
  }

  async updateProfile(
    id: string,
    data: UpdateProfileRequest
  ): Promise<Profile> {
    const current = await this.profileRepository.findById(id);
    if (!current) {
      throw new ProfileNotFoundError();
    }

    // Name and picture first: they have no policy, and doing them in one
    // statement keeps a rejected handle from silently discarding a name the
    // user also typed... which is exactly why the handle is validated *before*
    // anything is written.
    let handleResult: ProfileRow | null = null;

    if (data.handle !== undefined) {
      handleResult = await this.applyHandle(current, data.handle);
    }

    const fieldUpdate: Record<string, unknown> = {};
    if (data.name !== undefined) fieldUpdate.name = data.name;
    if (data.pictureUrl !== undefined) {
      fieldUpdate.picture_url = data.pictureUrl;
    }

    if (Object.keys(fieldUpdate).length > 0) {
      const updated = await this.profileRepository.update(id, fieldUpdate);
      return this.mapDatabaseToProfile(updated);
    }

    return this.mapDatabaseToProfile(handleResult ?? current);
  }

  /**
   * Validate, then write, then let the unique index have the last word.
   *
   * The taken-check is deliberately *not* a read followed by a write: two
   * people claiming the same handle in the same second would both read "free"
   * and one of them would get a 500. The pre-read exists only to produce a
   * good error most of the time; `setHandle` returning `null` is what actually
   * decides it.
   */
  private async applyHandle(
    current: ProfileRow,
    rawHandle: string
  ): Promise<ProfileRow> {
    const handle = normaliseHandle(rawHandle);
    assertValidHandle(handle);

    const now = new Date();
    const unchanged = current.handle === handle;

    if (!unchanged) {
      const blockedUntil = handleChangeAvailableAt(
        current.handle_changed_at,
        now
      );
      if (blockedUntil) {
        throw new HandleCooldownError(blockedUntil);
      }

      const existing = await this.profileRepository.findByHandle(handle);
      if (existing && existing.id !== current.id) {
        throw new HandleUnavailableError(handle);
      }
    }

    const updated = await this.profileRepository.setHandle(current.id, handle, {
      claimedAt: current.handle_claimed_at ?? now,
      // Confirming the reserved handle as-is claims it without spending the
      // 30-day allowance. Nothing changed, so nothing is on cooldown.
      changedAt: unchanged ? undefined : now,
    });

    if (!updated) {
      throw new HandleUnavailableError(handle);
    }

    return updated;
  }

  private mapDatabaseToProfile(data: ProfileRow): Profile {
    const availableAt = handleChangeAvailableAt(data.handle_changed_at);

    return {
      id: data.id,
      name: data.name || undefined,
      email: data.email || undefined,
      pictureUrl: data.picture_url || undefined,
      handle: data.handle || undefined,
      // A reserved handle nobody confirmed is not a claimed one. This is the
      // single flag the whole claim flow hangs off.
      handleClaimed: data.handle_claimed_at !== null,
      handleChangeAvailableAt: availableAt ?? undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
