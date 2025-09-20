import { Collection } from '../types';
import { CollectionRepository } from '../repositories';
import { NewCollection, CollectionUpdate } from '../database/schema';

export interface CollectionService {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection>;
  update(id: string, data: Partial<Collection>): Promise<Collection>;
  delete(id: string): Promise<void>;
}

export class CollectionServiceImpl implements CollectionService {
  constructor(private collectionRepository: CollectionRepository) {}

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