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

export interface CollectionService {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection>;
  update(id: string, data: Partial<Collection>): Promise<Collection>;
  delete(id: string): Promise<void>;

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
      throw new Error('Collection suggestion not found');
    }
    if (row.status !== 'pending') {
      throw new Error(`Collection suggestion already ${row.status}`);
    }

    const parentId = row.parent_id ?? null;
    if (parentId !== null) {
      const parent = await this.collectionRepository.findByIdAndUser(
        parentId,
        userId
      );
      // Two levels, and no deeper — the same cap the API enforces. A proposal
      // whose parent has itself moved under something else since it was made
      // would otherwise create the third level by the back door.
      if (!parent) {
        throw new Error('Parent collection not found');
      }
      if (parent.parent_id !== null) {
        throw new Error('Collections are limited to two levels');
      }
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
      throw new Error('Collection suggestion not found');
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