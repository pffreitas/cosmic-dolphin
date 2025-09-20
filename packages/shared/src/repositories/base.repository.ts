import { Kysely } from 'kysely';
import { Database } from '../database/schema';

export abstract class BaseRepository {
  constructor(protected db: Kysely<Database>) {}

  protected handleError(error: unknown, operation: string): never {
    console.error(`Repository error during ${operation}:`, error);

    if (error instanceof Error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }

    throw new Error(`Database operation failed during ${operation}`);
  }

  protected async executeQuery<T>(
    queryFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      this.handleError(error, operation);
    }
  }
}