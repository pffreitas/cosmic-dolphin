import { describe, it, expect, beforeEach } from '@jest/globals';
import { CollectionRepositoryImpl } from '../../repositories/collection.repository';
import { getTestDatabase } from '../../test-utils/database';
import { TestDataFactory } from '../../test-utils/factories';

describe('CollectionRepository', () => {
  let repository: CollectionRepositoryImpl;
  let testUserId: string;

  beforeEach(() => {
    const db = getTestDatabase();
    repository = new CollectionRepositoryImpl(db);
    testUserId = TestDataFactory.generateUserId();
  });

  describe('create', () => {
    it('should create a new collection', async () => {
      const collectionData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Test Collection',
      });

      const result = await repository.create(collectionData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(collectionData.name);
      expect(result.user_id).toBe(testUserId);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should create a collection with all fields', async () => {
      const collectionData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Full Test Collection',
        description: 'A complete test collection',
        color: '#FF5733',
        icon: '🚀',
        is_public: true,
      });

      const result = await repository.create(collectionData);

      expect(result.name).toBe(collectionData.name);
      expect(result.description).toBe(collectionData.description);
      expect(result.color).toBe(collectionData.color);
      expect(result.icon).toBe(collectionData.icon);
      expect(result.is_public).toBe(true);
    });

    it('should create a nested collection with parent_id', async () => {
      // Create parent collection
      const parentData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Parent Collection',
      });
      const parent = await repository.create(parentData);

      // Create child collection
      const childData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Child Collection',
        parent_id: parent.id,
      });
      const child = await repository.create(childData);

      expect(child.parent_id).toBe(parent.id);
    });
  });

  describe('findByIdAndUser', () => {
    it('should find a collection by ID and user', async () => {
      const collectionData = TestDataFactory.createCollection({ user_id: testUserId });
      const created = await repository.create(collectionData);

      const found = await repository.findByIdAndUser(created.id, testUserId);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.user_id).toBe(testUserId);
      expect(found!.name).toBe(created.name);
    });

    it('should return null when collection ID is not found', async () => {
      const result = await repository.findByIdAndUser('00000000-0000-0000-0000-000000000000', testUserId);
      expect(result).toBeNull();
    });

    it('should not find collection for different user', async () => {
      const collectionData = TestDataFactory.createCollection({ user_id: testUserId });
      const created = await repository.create(collectionData);
      const otherUserId = TestDataFactory.generateUserId();

      const found = await repository.findByIdAndUser(created.id, otherUserId);

      expect(found).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should find all collections for a user', async () => {
      const collections = TestDataFactory.createMultipleCollections(3, testUserId);

      for (const collection of collections) {
        await repository.create(collection);
      }

      const found = await repository.findByUser(testUserId);

      expect(found).toHaveLength(3);
      expect(found.every(c => c.user_id === testUserId)).toBe(true);
    });

    it('should return collections in created_at descending order', async () => {
      const collections = TestDataFactory.createMultipleCollections(3, testUserId);

      const created = [];
      for (const collection of collections) {
        const result = await repository.create(collection);
        created.push(result);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const found = await repository.findByUser(testUserId);

      // Should be in descending order (newest first)
      expect(found[0].created_at.getTime()).toBeGreaterThan(found[1].created_at.getTime());
      expect(found[1].created_at.getTime()).toBeGreaterThan(found[2].created_at.getTime());
    });

    it('should not return collections from other users', async () => {
      const otherUserId = TestDataFactory.generateUserId();

      // Create collections for both users
      const myCollection = TestDataFactory.createCollection({ user_id: testUserId });
      const otherCollection = TestDataFactory.createCollection({ user_id: otherUserId });

      await repository.create(myCollection);
      await repository.create(otherCollection);

      const found = await repository.findByUser(testUserId);

      expect(found).toHaveLength(1);
      expect(found[0].user_id).toBe(testUserId);
    });

    it('should return empty array when user has no collections', async () => {
      const found = await repository.findByUser(testUserId);
      expect(found).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update a collection', async () => {
      const collectionData = TestDataFactory.createCollection({ user_id: testUserId });
      const created = await repository.create(collectionData);

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateData = {
        name: 'Updated Collection Name',
        description: 'Updated description',
        color: '#00FF00',
        is_public: true,
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe(updateData.name);
      expect(updated.description).toBe(updateData.description);
      expect(updated.color).toBe(updateData.color);
      expect(updated.is_public).toBe(true);
      expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(created.updated_at.getTime());
    });

    it('should update only specified fields', async () => {
      const collectionData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Original Name',
        description: 'Original Description',
      });
      const created = await repository.create(collectionData);

      const updateData = {
        name: 'Updated Name Only',
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.name).toBe(updateData.name);
      expect(updated.description).toBe(created.description); // Should remain unchanged
    });

    it('should update parent_id for hierarchy changes', async () => {
      // Create parent collection
      const parentData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Parent Collection',
      });
      const parent = await repository.create(parentData);

      // Create child collection without parent
      const childData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'Child Collection',
      });
      const child = await repository.create(childData);

      // Update child to have parent
      const updated = await repository.update(child.id, { parent_id: parent.id });

      expect(updated.parent_id).toBe(parent.id);
    });
  });

  describe('delete', () => {
    it('should delete a collection', async () => {
      const collectionData = TestDataFactory.createCollection({ user_id: testUserId });
      const created = await repository.create(collectionData);

      await repository.delete(created.id);

      const found = await repository.findByIdAndUser(created.id, testUserId);
      expect(found).toBeNull();
    });

    it('should delete collection even if it has bookmarks', async () => {
      const collectionData = TestDataFactory.createCollection({ user_id: testUserId });
      const collection = await repository.create(collectionData);

      // Create a bookmark in this collection
      const db = getTestDatabase();
      const bookmarkData = TestDataFactory.createBookmark({
        user_id: testUserId,
        collection_id: collection.id,
      });
      await db.insertInto('bookmarks').values(bookmarkData).execute();

      // Delete should still work (assuming foreign key is set to SET NULL or CASCADE)
      await repository.delete(collection.id);

      const found = await repository.findByIdAndUser(collection.id, testUserId);
      expect(found).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Try to create a collection with invalid data (e.g., extremely long name)
      const invalidData = TestDataFactory.createCollection({
        user_id: testUserId,
        name: 'x'.repeat(1000), // Assuming there's a length limit
      });

      await expect(repository.create(invalidData)).rejects.toThrow();
    });

    it('should handle update of non-existent collection', async () => {
      await expect(
        repository.update('00000000-0000-0000-0000-000000000000', { name: 'Updated Name' })
      ).rejects.toThrow();
    });

    it('should handle delete of non-existent collection', async () => {
      // Delete should complete without throwing, even if collection doesn't exist
      await expect(repository.delete('00000000-0000-0000-0000-000000000000')).resolves.toBeUndefined();
    });
  });
});