import { Kysely } from 'kysely';
import { Database } from '../database/schema';

export abstract class BaseRepository {
  constructor(protected db: Kysely<Database>) {}

  protected handleError(error: unknown, operation: string): never {
    if (error instanceof Error) {
      // Preserve SQLSTATE for callers such as concurrent capture recovery. Keep
      // the cause non-enumerable, like native Error.cause, so structured logs
      // do not accidentally enumerate database query parameters.
      const wrapped = new Error(`Database operation failed: ${error.message}`);
      Object.defineProperty(wrapped, "cause", { value: error, configurable: true });
      throw wrapped;
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