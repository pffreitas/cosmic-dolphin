import { Collection } from '../types';

export interface CollectionService {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection>;
  update(id: string, data: Partial<Collection>): Promise<Collection>;
  delete(id: string): Promise<void>;
}

export class CollectionServiceImpl implements CollectionService {
  constructor(private supabaseClient: any) {}

  async findByIdAndUser(id: string, userId: string): Promise<Collection | null> {
    const { data, error } = await this.supabaseClient
      .from('collections')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find collection: ${error.message}`);
    }

    return this.mapDatabaseToCollection(data);
  }

  async findByUser(userId: string): Promise<Collection[]> {
    const { data, error } = await this.supabaseClient
      .from('collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }

    return data.map(this.mapDatabaseToCollection);
  }

  async create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection> {
    const insertData = {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      parent_id: data.parentId,
      user_id: data.userId,
      is_public: data.isPublic || false,
    };

    const { data: collection, error } = await this.supabaseClient
      .from('collections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create collection: ${error.message}`);
    }

    return this.mapDatabaseToCollection(collection);
  }

  async update(id: string, data: Partial<Collection>): Promise<Collection> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId;
    if (data.userId !== undefined) updateData.user_id = data.userId;
    if (data.isPublic !== undefined) updateData.is_public = data.isPublic;

    const { data: collection, error } = await this.supabaseClient
      .from('collections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update collection: ${error.message}`);
    }

    return this.mapDatabaseToCollection(collection);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('collections')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete collection: ${error.message}`);
    }
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