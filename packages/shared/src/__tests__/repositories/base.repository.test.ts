import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Kysely } from 'kysely';
import { BaseRepository } from '../../repositories/base.repository';
import { Database } from '../../database/schema';
import { getTestDatabase } from '../../test-utils/database';

// Test implementation of BaseRepository
class TestRepository extends BaseRepository {
  constructor(db: Kysely<Database>) {
    super(db);
  }

  // Expose protected methods for testing
  public testHandleError(error: unknown, operation: string): never {
    return this.handleError(error, operation);
  }

  public async testExecuteQuery<T>(
    queryFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    return this.executeQuery(queryFn, operation);
  }

  // Test method that uses the database
  public async testQuery(): Promise<any[]> {
    return this.executeQuery(async () => {
      return await this.db.selectFrom('collections').selectAll().limit(1).execute();
    }, 'test query');
  }

  // Test method that throws an error
  public async testErrorQuery(): Promise<any> {
    return this.executeQuery(async () => {
      throw new Error('Test database error');
    }, 'test error query');
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;

  beforeEach(() => {
    const db = getTestDatabase();
    repository = new TestRepository(db);
  });

  describe('handleError', () => {
    it('should handle Error instances correctly', () => {
      const originalError = new Error('Original error message');

      expect(() => {
        repository.testHandleError(originalError, 'test operation');
      }).toThrow('Database operation failed: Original error message');
    });

    it('should handle non-Error instances', () => {
      const originalError = 'String error';

      expect(() => {
        repository.testHandleError(originalError, 'test operation');
      }).toThrow('Database operation failed during test operation');
    });

    it('should handle null/undefined errors', () => {
      expect(() => {
        repository.testHandleError(null, 'test operation');
      }).toThrow('Database operation failed during test operation');

      expect(() => {
        repository.testHandleError(undefined, 'test operation');
      }).toThrow('Database operation failed during test operation');
    });

    it('should handle complex error objects', () => {
      const complexError = {
        message: 'Complex error',
        code: 'DB_ERROR',
        details: 'Some details',
      };

      expect(() => {
        repository.testHandleError(complexError, 'complex operation');
      }).toThrow('Database operation failed during complex operation');
    });
  });

  describe('executeQuery', () => {
    it('should execute successful queries', async () => {
      const result = await repository.testQuery();

      // Should return an array (empty or with collections)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle database errors and wrap them', async () => {
      await expect(repository.testErrorQuery()).rejects.toThrow('Database operation failed: Test database error');
    });

    it('should execute custom query functions', async () => {
      const mockQuery = jest.fn<() => Promise<string>>().mockResolvedValue('test result');

      const result = await repository.testExecuteQuery(mockQuery, 'custom operation');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toBe('test result');
    });

    it('should handle async query function errors', async () => {
      const mockQuery = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('Async error'));

      await expect(
        repository.testExecuteQuery(mockQuery, 'async operation')
      ).rejects.toThrow('Database operation failed: Async error');

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should preserve the return type of the query function', async () => {
      // Test with different return types
      const stringQuery = () => Promise.resolve('string result');
      const numberQuery = () => Promise.resolve(42);
      const objectQuery = () => Promise.resolve({ id: 1, name: 'test' });
      const arrayQuery = () => Promise.resolve([1, 2, 3]);

      const stringResult = await repository.testExecuteQuery(stringQuery, 'string test');
      const numberResult = await repository.testExecuteQuery(numberQuery, 'number test');
      const objectResult = await repository.testExecuteQuery(objectQuery, 'object test');
      const arrayResult = await repository.testExecuteQuery(arrayQuery, 'array test');

      expect(typeof stringResult).toBe('string');
      expect(stringResult).toBe('string result');

      expect(typeof numberResult).toBe('number');
      expect(numberResult).toBe(42);

      expect(typeof objectResult).toBe('object');
      expect(objectResult).toEqual({ id: 1, name: 'test' });

      expect(Array.isArray(arrayResult)).toBe(true);
      expect(arrayResult).toEqual([1, 2, 3]);
    });
  });

  describe('database access', () => {
    it('should have access to the database instance', () => {
      expect(repository['db']).toBeDefined();
      expect(typeof repository['db'].selectFrom).toBe('function');
    });

    it('should be able to perform basic database operations', async () => {
      // This tests that the database connection is working
      const result = await repository.testQuery();
      expect(result).toBeDefined();
    });
  });

  describe('error consistency', () => {
    it('should provide consistent error messages across different error types', () => {
      const testCases = [
        { error: new Error('DB connection failed'), expected: 'Database operation failed: DB connection failed' },
        { error: new TypeError('Invalid query'), expected: 'Database operation failed: Invalid query' },
        { error: new ReferenceError('Table not found'), expected: 'Database operation failed: Table not found' },
      ];

      testCases.forEach(({ error, expected }) => {
        expect(() => {
          repository.testHandleError(error, 'consistency test');
        }).toThrow(expected);
      });
    });

    it('should handle database-specific errors', async () => {
      // Test with a query that would cause a database error
      const invalidQuery = async () => {
        // This should cause a syntax error
        return await repository['db'].executeQuery({
          kind: 'SelectQueryNode',
          from: { kind: 'TableNode', table: { kind: 'IdentifierNode', name: 'nonexistent_table' } },
        } as any);
      };

      await expect(
        repository.testExecuteQuery(invalidQuery, 'invalid query test')
      ).rejects.toThrow(/Database operation failed/);
    });
  });
});