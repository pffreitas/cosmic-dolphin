import { Collection, CollectionSuggestion } from '../types';
import { CollectionRepository } from '../repositories';
import { NewCollection, CollectionUpdate } from '../database/schema';
import { BookmarkService } from './bookmark.service';
import {
  MIN_SUGGESTION_SUPPORT,
  SUGGESTION_DISMISSAL_DAYS,
  mapSuggestionRow,
} from './bookmark.filing.service';

/**
 * What accepting a suggestion did.
 *
 * `filedCount` can be lower than the number of supporting bookmarks: a
 * supporter the user has since filed by hand is not moved, because
 * `fileByPipeline` refuses it. Accepting a grouping the AI proposed is not a
 * licence to undo a decision the user has already made about one of its
 * members.
 */
export interface AcceptedCollectionSuggestion {
  collection: Collection;
  suggestion: CollectionSuggestion;
  filedCount: number;
}

/**
 * How deep the tree is allowed to go — a root and one level of children.
 *
 * "A third level is where folder systems start to fail people, and the AI has
 * no way to justify one" (docs/functional-spec/04-library.md § Collections).
 * The cap is enforced here, in the service, so every path into the tree —
 * create, reparent, and accepting a suggestion — is checked by the same code.
 */
export const COLLECTION_MAX_DEPTH = 2;

/** One wording for the cap, so every rejection reads the same. */
export const COLLECTION_MAX_DEPTH_MESSAGE =
  'Collections are limited to two levels';

export type CollectionErrorCode =
  | "invalid"
  | "not_found"
  | "parent_not_found"
  | "max_depth"
  | "conflict";

/**
 * A rule the caller broke, with enough information for a route to pick a status
 * code without string-matching on messages.
 */
export class CollectionError extends Error {
  constructor(
    readonly code: CollectionErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

export const MAX_COLLECTION_NAME_LENGTH = 120;

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
  isPublic?: boolean;
}

/**
 * Rename, recolour, reparent. Every field is optional and an absent field is
 * left alone; `null` on a nullable field clears it, and `parentId: null` moves
 * the collection back to the root.
 */
export type UpdateCollectionInput = Partial<CreateCollectionInput>;

function normaliseName(name: string | undefined): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) {
    throw new CollectionError('invalid', 'name is required');
  }
  if (trimmed.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new CollectionError(
      'invalid',
      `name must be at most ${MAX_COLLECTION_NAME_LENGTH} characters`
    );
  }
  return trimmed;
}

export interface CollectionService {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection>;
  update(id: string, data: Partial<Collection>): Promise<Collection>;
  delete(id: string): Promise<void>;

  /**
   * Create a collection for a user, with the two-level cap enforced.
   *
   * Throws `CollectionError`. The plain `create` above stays as it is because
   * the worker and the suggestion path use it with ids they have already
   * checked; anything reachable from HTTP goes through this.
   */
  createForUser(
    userId: string,
    input: CreateCollectionInput
  ): Promise<Collection>;
  /**
   * Rename, recolour, or reparent a collection the user owns.
   *
   * Reparenting is checked from **both** ends: the new parent must be a root
   * collection, and a collection that has children of its own cannot be moved
   * under anything — either would put some collection at a third level.
   */
  updateForUser(
    id: string,
    userId: string,
    input: UpdateCollectionInput
  ): Promise<Collection>;
  /**
   * Delete a collection the user owns.
   *
   * Its bookmarks move to Inbox and are never deleted: `bookmarks.collection_id`
   * is `ON DELETE SET NULL`, and Inbox *is* `collection_id IS NULL`. Child
   * collections go with it (`parent_id` is `ON DELETE CASCADE`) and their
   * bookmarks land in Inbox by the same rule.
   */
  deleteForUser(id: string, userId: string): Promise<void>;

  /**
   * The proposals worth showing: pending, and supported by at least
   * `MIN_SUGGESTION_SUPPORT` bookmarks. A proposal below the threshold exists
   * but is not the user's problem yet.
   */
  findOfferableSuggestions(userId: string): Promise<CollectionSuggestion[]>;
  findSuggestions(userId: string): Promise<CollectionSuggestion[]>;
  /**
   * Create the proposed collection and move its supporters into it.
   *
   * This is the only place a proposal ever becomes a collection, and it is
   * reached only from a user action. The pipeline has no path to it.
   */
  acceptSuggestion(
    id: string,
    userId: string
  ): Promise<AcceptedCollectionSuggestion>;
  /** Remembered, not permanent: the proposal may return after 30 days. */
  dismissSuggestion(id: string, userId: string): Promise<CollectionSuggestion>;
}

export class CollectionServiceImpl implements CollectionService {
  constructor(
    private collectionRepository: CollectionRepository,
    private bookmarkService: BookmarkService
  ) {}

  async findByIdAndUser(id: string, userId: string): Promise<Collection | null> {
    const collection = await this.collectionRepository.findByIdAndUser(id, userId);
    return collection ? this.mapDatabaseToCollection(collection) : null;
  }

  async findByUser(userId: string): Promise<Collection[]> {
    const collections = await this.collectionRepository.findByUser(userId);
    return collections.map(this.mapDatabaseToCollection);
  }

  async create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection> {
    const newCollection: NewCollection = {
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      icon: data.icon || null,
      parent_id: data.parentId || null,
      user_id: data.userId,
      is_public: data.isPublic || false,
    };

    const collection = await this.collectionRepository.create(newCollection);
    return this.mapDatabaseToCollection(collection);
  }

  async update(id: string, data: Partial<Collection>): Promise<Collection> {
    const updateData: CollectionUpdate = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId;
    if (data.userId !== undefined) updateData.user_id = data.userId;
    if (data.isPublic !== undefined) updateData.is_public = data.isPublic;

    const collection = await this.collectionRepository.update(id, updateData);
    return this.mapDatabaseToCollection(collection);
  }

  async delete(id: string): Promise<void> {
    await this.collectionRepository.delete(id);
  }

  async createForUser(
    userId: string,
    input: CreateCollectionInput
  ): Promise<Collection> {
    const name = normaliseName(input.name);
    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      await this.assertUsableParent(parentId, userId);
    }

    const collection = await this.collectionRepository.create({
      name,
      description: input.description ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      parent_id: parentId,
      user_id: userId,
      is_public: input.isPublic ?? false,
    });

    return this.mapDatabaseToCollection(collection);
  }

  async updateForUser(
    id: string,
    userId: string,
    input: UpdateCollectionInput
  ): Promise<Collection> {
    const existing = await this.collectionRepository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new CollectionError('not_found', 'Collection not found');
    }

    const updateData: CollectionUpdate = {};

    if (input.name !== undefined) {
      updateData.name = normaliseName(input.name);
    }
    if (input.description !== undefined) {
      updateData.description = input.description ?? null;
    }
    if (input.color !== undefined) updateData.color = input.color ?? null;
    if (input.icon !== undefined) updateData.icon = input.icon ?? null;
    if (input.isPublic !== undefined) updateData.is_public = input.isPublic;

    if (input.parentId !== undefined) {
      const parentId = input.parentId ?? null;
      await this.assertReparentable(id, userId, parentId);
      updateData.parent_id = parentId;
    }

    if (Object.keys(updateData).length === 0) {
      return this.mapDatabaseToCollection(existing);
    }

    const collection = await this.collectionRepository.update(id, updateData);
    return this.mapDatabaseToCollection(collection);
  }

  async deleteForUser(id: string, userId: string): Promise<void> {
    const existing = await this.collectionRepository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new CollectionError('not_found', 'Collection not found');
    }
    await this.collectionRepository.delete(id);
  }

  /**
   * A collection may be a parent only if it exists, belongs to the caller, and
   * is itself at the root. Anything else makes the new child a third level.
   */
  private async assertUsableParent(
    parentId: string,
    userId: string
  ): Promise<void> {
    const parent = await this.collectionRepository.findByIdAndUser(
      parentId,
      userId
    );
    if (!parent) {
      throw new CollectionError(
        'parent_not_found',
        'Parent collection not found'
      );
    }
    if (parent.parent_id !== null) {
      throw new CollectionError('max_depth', COLLECTION_MAX_DEPTH_MESSAGE);
    }
  }

  /**
   * The reparent path, which has two ways to smuggle in a third level and
   * needs both closed.
   *
   * 1. The new parent is itself a child — the moved collection would sit at
   *    level three. Caught by `assertUsableParent`.
   * 2. The moved collection has children of its own — *they* would sit at
   *    level three, even though the moved collection lands at level two. This
   *    one is invisible if you only look at the collection being moved.
   *
   * A collection naming itself as its parent is the degenerate cycle; with the
   * cap at two levels it is the only cycle reachable, because every other
   * candidate parent is either a root (no ancestors) or already rejected by (1).
   */
  private async assertReparentable(
    id: string,
    userId: string,
    parentId: string | null
  ): Promise<void> {
    if (parentId === null) {
      // Moving to the root can never deepen anything.
      return;
    }

    if (parentId === id) {
      throw new CollectionError(
        'invalid',
        'A collection cannot be its own parent'
      );
    }

    await this.assertUsableParent(parentId, userId);

    const tree = await this.collectionRepository.findByUser(userId);
    const hasChildren = tree.some((c) => c.parent_id === id);
    if (hasChildren) {
      throw new CollectionError(
        'max_depth',
        `${COLLECTION_MAX_DEPTH_MESSAGE}: move or delete this collection's children first`
      );
    }
  }

  async findOfferableSuggestions(
    userId: string
  ): Promise<CollectionSuggestion[]> {
    const rows = await this.collectionRepository.findSuggestionsByUser(userId, {
      status: 'pending',
      minSupport: MIN_SUGGESTION_SUPPORT,
    });
    return rows.map(mapSuggestionRow);
  }

  async findSuggestions(userId: string): Promise<CollectionSuggestion[]> {
    const rows = await this.collectionRepository.findSuggestionsByUser(userId);
    return rows.map(mapSuggestionRow);
  }

  async acceptSuggestion(
    id: string,
    userId: string
  ): Promise<AcceptedCollectionSuggestion> {
    const row = await this.collectionRepository.findSuggestionByIdAndUser(
      id,
      userId
    );
    if (!row) {
      throw new CollectionError('not_found', 'Collection suggestion not found');
    }
    if (row.status !== 'pending') {
      throw new CollectionError(
        'conflict',
        `Collection suggestion already ${row.status}`
      );
    }

    const parentId = row.parent_id ?? null;
    if (parentId !== null) {
      // Two levels, and no deeper — the same check, and the same code, the
      // create and reparent paths run. A proposal whose parent has itself moved
      // under something else since it was made would otherwise create the third
      // level by the back door.
      await this.assertUsableParent(parentId, userId);
    }

    // The user may have created the collection by hand in the meantime.
    const existing = await this.collectionRepository.findByNameAndParent(
      userId,
      row.name,
      parentId
    );
    const created =
      existing ??
      (await this.collectionRepository.create({
        name: row.name,
        user_id: userId,
        parent_id: parentId,
      }));

    let filedCount = 0;
    for (const bookmarkId of row.bookmark_ids) {
      const filed = await this.bookmarkService.fileByPipeline(
        bookmarkId,
        created.id
      );
      if (filed) filedCount += 1;
    }

    const accepted = await this.collectionRepository.updateSuggestionStatus(
      id,
      userId,
      'accepted'
    );

    return {
      collection: this.mapDatabaseToCollection(created),
      suggestion: mapSuggestionRow(accepted ?? { ...row, status: 'accepted' }),
      filedCount,
    };
  }

  async dismissSuggestion(
    id: string,
    userId: string
  ): Promise<CollectionSuggestion> {
    const dismissedUntil = new Date(
      Date.now() + SUGGESTION_DISMISSAL_DAYS * 24 * 60 * 60 * 1000
    );
    const dismissed = await this.collectionRepository.updateSuggestionStatus(
      id,
      userId,
      'dismissed',
      dismissedUntil
    );
    if (!dismissed) {
      throw new CollectionError('not_found', 'Collection suggestion not found');
    }
    return mapSuggestionRow(dismissed);
  }

  private mapDatabaseToCollection(data: any): Collection {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      parentId: data.parent_id,
      userId: data.user_id,
      isPublic: data.is_public,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}