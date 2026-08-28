import {
  BlockResponse,
  FollowResponse,
  PublicProfile,
  PublicProfileListResponse,
  PublicSavesResponse,
} from "../types";
import {
  PublicProfileRow,
  RelationshipState,
  SocialKeyset,
  SocialRepository,
} from "../repositories/social.repository";
import { mapDatabaseRowToBookmark } from "./bookmark.service";
import { normaliseHandle } from "./profile.service";

/**
 * Follows, blocks, and the public view of a profile.
 *
 * Two rules run through every method here, and both are enforced in this file
 * rather than in the route handlers — a route guard is a thing you can forget
 * to add to the seventh endpoint.
 *
 * **A block makes its subject disappear.** When the profile being asked about
 * has blocked the caller, every read returns `null` and the route answers 404.
 * Not 403: a 403 confirms the account exists and that something about the
 * caller is the reason they cannot see it, which is precisely the information
 * a block is meant to withhold. The same `null` covers "no such handle", so
 * the two are indistinguishable from outside.
 *
 * **Following is reciprocal-free and immediate.** There is no request, no
 * acceptance, no pending state — `follow` writes one row and returns the
 * count. The only thing that can refuse it is a block in either direction, and
 * that refusal is a 404 for the same reason as above.
 */

/** Something the caller sent is wrong. A 400. */
export class SocialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialValidationError";
  }
}

export const SOCIAL_PAGE_DEFAULT_LIMIT = 24;
export const SOCIAL_PAGE_MAX_LIMIT = 100;

/**
 * The last row of a page, for the caller to encode into an opaque cursor.
 * The API layer owns the encoding; the service only names the columns.
 */
export interface SocialPageCursor {
  createdAt: Date;
  id: string;
}

/** What a paged social read accepts. */
export interface SocialPageOptions {
  /** The caller, when there is one. Anonymous reads pass nothing. */
  viewerId?: string | null;
  limit?: number;
  cursor?: SocialKeyset | null;
}

export interface SocialService {
  /** `null` when there is no such handle, or the profile blocked the caller. */
  getPublicProfile(
    handle: string,
    viewerId?: string | null
  ): Promise<PublicProfile | null>;

  listPublicSaves(
    handle: string,
    options?: SocialPageOptions
  ): Promise<(PublicSavesResponse & { lastRow: SocialPageCursor | null }) | null>;

  listFollowers(
    handle: string,
    options?: SocialPageOptions
  ): Promise<
    (PublicProfileListResponse & { lastRow: SocialPageCursor | null }) | null
  >;

  listFollowing(
    handle: string,
    options?: SocialPageOptions
  ): Promise<
    (PublicProfileListResponse & { lastRow: SocialPageCursor | null }) | null
  >;

  follow(followerId: string, handle: string): Promise<FollowResponse | null>;
  unfollow(followerId: string, handle: string): Promise<FollowResponse | null>;

  block(blockerId: string, handle: string): Promise<BlockResponse | null>;
  unblock(blockerId: string, handle: string): Promise<BlockResponse | null>;

  /**
   * May these two people's content reach each other at all?
   *
   * False when either has blocked the other — a block is symmetric in effect
   * even though the row is not, because content flowing either way defeats it.
   * True for a user and themselves.
   *
   * Keyed on ids rather than handles because the caller already has a row: a
   * reshare knows the bookmark's `userId` and would have to look a handle up
   * only to hand it back for a second lookup.
   */
  canInteract(viewerId: string, otherUserId: string): Promise<boolean>;
}

export class SocialServiceImpl implements SocialService {
  constructor(private socialRepository: SocialRepository) {}

  async getPublicProfile(
    handle: string,
    viewerId?: string | null
  ): Promise<PublicProfile | null> {
    const resolved = await this.resolveVisible(handle, viewerId);
    if (!resolved) return null;

    const { row, relationship } = resolved;
    const counts = await this.socialRepository.countsFor(row.id);

    return toPublicProfile(row, {
      counts,
      viewerId,
      relationship,
    });
  }

  async listPublicSaves(
    handle: string,
    options: SocialPageOptions = {}
  ): Promise<
    (PublicSavesResponse & { lastRow: SocialPageCursor | null }) | null
  > {
    const resolved = await this.resolveVisible(handle, options.viewerId);
    if (!resolved) return null;

    const { row, relationship } = resolved;

    // The caller blocked *them*. The profile stays reachable so the block can
    // be undone from it, but its content does not: a block that still fed you
    // the other person's saves would not be a block.
    if (relationship?.viewerBlocked) {
      return { bookmarks: [], lastRow: null };
    }

    const limit = clampLimit(options.limit);
    const rows = await this.socialRepository.listPublicSaves(
      row.id,
      limit + 1,
      options.cursor ?? null
    );

    const page = takePage(rows, limit);

    return {
      bookmarks: page.items.map((item) => mapDatabaseRowToBookmark(item)),
      lastRow: page.last
        ? { createdAt: new Date(page.last.created_at), id: page.last.id }
        : null,
    };
  }

  async listFollowers(
    handle: string,
    options: SocialPageOptions = {}
  ): Promise<
    (PublicProfileListResponse & { lastRow: SocialPageCursor | null }) | null
  > {
    return this.listGraph("followers", handle, options);
  }

  async listFollowing(
    handle: string,
    options: SocialPageOptions = {}
  ): Promise<
    (PublicProfileListResponse & { lastRow: SocialPageCursor | null }) | null
  > {
    return this.listGraph("following", handle, options);
  }

  async follow(
    followerId: string,
    handle: string
  ): Promise<FollowResponse | null> {
    const target = await this.resolveForWrite(followerId, handle);
    if (!target) return null;

    await this.socialRepository.follow(followerId, target.id);
    const counts = await this.socialRepository.countsFor(target.id);

    return { following: true, followerCount: counts.followers };
  }

  async unfollow(
    followerId: string,
    handle: string
  ): Promise<FollowResponse | null> {
    const target = await this.resolveForWrite(followerId, handle);
    if (!target) return null;

    await this.socialRepository.unfollow(followerId, target.id);
    const counts = await this.socialRepository.countsFor(target.id);

    // Unfollowing is immediate and silent. Nobody is told.
    return { following: false, followerCount: counts.followers };
  }

  async block(
    blockerId: string,
    handle: string
  ): Promise<BlockResponse | null> {
    const row = await this.socialRepository.findPublicProfileByHandle(
      normaliseHandle(handle)
    );
    if (!row) return null;

    if (row.id === blockerId) {
      throw new SocialValidationError("You cannot block yourself.");
    }

    // Deliberately does *not* go through `resolveForWrite`: being blocked by
    // someone must not stop you blocking them back.
    await this.socialRepository.block(blockerId, row.id);

    return { blocked: true };
  }

  async unblock(
    blockerId: string,
    handle: string
  ): Promise<BlockResponse | null> {
    const row = await this.socialRepository.findPublicProfileByHandle(
      normaliseHandle(handle)
    );
    if (!row) return null;

    if (row.id === blockerId) {
      throw new SocialValidationError("You cannot block yourself.");
    }

    await this.socialRepository.unblock(blockerId, row.id);

    return { blocked: false };
  }

  private async listGraph(
    direction: "followers" | "following",
    handle: string,
    options: SocialPageOptions
  ): Promise<
    (PublicProfileListResponse & { lastRow: SocialPageCursor | null }) | null
  > {
    const resolved = await this.resolveVisible(handle, options.viewerId);
    if (!resolved) return null;

    const limit = clampLimit(options.limit);
    const rows =
      direction === "followers"
        ? await this.socialRepository.listFollowers(
            resolved.row.id,
            limit + 1,
            options.cursor ?? null
          )
        : await this.socialRepository.listFollowing(
            resolved.row.id,
            limit + 1,
            options.cursor ?? null
          );

    const page = takePage(rows, limit);

    return {
      profiles: page.items
        // A profile whose handle could not be minted has no public URL and so
        // no place in a list every row of which links somewhere.
        .filter((entry) => entry.handle !== null)
        .map((entry) =>
          toPublicProfile(entry, { viewerId: options.viewerId })
        ),
      lastRow: page.last
        ? { createdAt: new Date(page.last.created_at), id: page.last.id }
        : null,
    };
  }

  async canInteract(viewerId: string, otherUserId: string): Promise<boolean> {
    if (viewerId === otherUserId) return true;

    const relationship = await this.socialRepository.relationship(
      viewerId,
      otherUserId
    );

    return !relationship.blockedViewer && !relationship.viewerBlocked;
  }

  /**
   * The one place "can this caller see this profile at all" is decided.
   *
   * Every read goes through it, which is what makes the block rule a property
   * of the service rather than a habit of whoever writes the next handler.
   */
  private async resolveVisible(
    handle: string,
    viewerId?: string | null
  ): Promise<{
    row: PublicProfileRow;
    relationship: RelationshipState | null;
  } | null> {
    const row = await this.socialRepository.findPublicProfileByHandle(
      normaliseHandle(handle)
    );
    if (!row) return null;

    if (!viewerId || viewerId === row.id) {
      return { row, relationship: null };
    }

    const relationship = await this.socialRepository.relationship(
      viewerId,
      row.id
    );

    // They blocked the caller. From here down the account does not exist.
    if (relationship.blockedViewer) return null;

    return { row, relationship };
  }

  /**
   * Resolve a follow target. `null` for "no such handle" and for "blocked in
   * either direction" alike — the route turns both into a 404.
   */
  private async resolveForWrite(
    actorId: string,
    handle: string
  ): Promise<PublicProfileRow | null> {
    const row = await this.socialRepository.findPublicProfileByHandle(
      normaliseHandle(handle)
    );
    if (!row) return null;

    if (row.id === actorId) {
      throw new SocialValidationError("You cannot follow yourself.");
    }

    const relationship = await this.socialRepository.relationship(
      actorId,
      row.id
    );

    // Either direction. Following someone you have blocked is incoherent, and
    // following someone who blocked you is what the block prevents.
    if (relationship.blockedViewer || relationship.viewerBlocked) return null;

    return row;
  }
}

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return SOCIAL_PAGE_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), SOCIAL_PAGE_MAX_LIMIT);
}

/**
 * Over-fetch by one, then drop it.
 *
 * `nextCursor` has to distinguish "the page is full" from "there is more", and
 * a page that happens to be exactly `limit` long is both. Asking for one extra
 * row settles it without a second count query.
 */
function takePage<T>(rows: T[], limit: number): { items: T[]; last: T | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    last: hasMore ? items[items.length - 1] ?? null : null,
  };
}

/**
 * The only function in the codebase that produces a `PublicProfile`.
 *
 * It reads from a `PublicProfileRow`, whose column list does not include
 * `email` — so this mapper could not leak one even if someone tried. The type
 * is the second lock and `assertPublicProfileHasNoEmail` in `types.ts` is the
 * third.
 */
export function toPublicProfile(
  row: PublicProfileRow,
  options: {
    counts?: {
      followers: number;
      following: number;
      publicSaves: number;
      collections: number;
    };
    viewerId?: string | null;
    relationship?: RelationshipState | null;
  } = {}
): PublicProfile {
  const { counts, viewerId, relationship } = options;

  return {
    id: row.id,
    handle: row.handle ?? "",
    name: row.name || undefined,
    pictureUrl: row.picture_url || undefined,
    joinedAt: new Date(row.created_at),
    counts: counts ?? {
      followers: 0,
      following: 0,
      publicSaves: 0,
      collections: 0,
    },
    isSelf: viewerId === row.id,
    ...(relationship
      ? {
          isFollowedByViewer: relationship.viewerFollows,
          followsViewer: relationship.followsViewer,
          isBlockedByViewer: relationship.viewerBlocked,
        }
      : {}),
  };
}
