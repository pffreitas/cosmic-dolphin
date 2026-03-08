import { Kysely, sql } from 'kysely';
import { Database } from '../database/schema';
import { createDatabase } from '../database/connection';

let testDb: Kysely<Database> | null = null;

export function getTestDatabase(): Kysely<Database> {
  if (!testDb) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required. Set it in .env.test for local development ' +
        'or as a CI secret for automated testing.'
      );
    }
    testDb = createDatabase(databaseUrl);
  }
  return testDb;
}

export async function clearDatabase(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE image_chunks, text_chunks, content_chunks, bookmark_likes, scraped_url_contents, bookmarks, collections CASCADE`.execute(db);
}

export async function closeTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.destroy();
    testDb = null;
  }
}

export class DatabaseTestUtils {
  constructor(private db: Kysely<Database>) {}

  async truncateAll(): Promise<void> {
    await clearDatabase(this.db);
  }

  async createTestUser(): Promise<string> {
    return 'test-user-' + Math.random().toString(36).substring(7);
  }

  async waitForConnection(): Promise<void> {
    let retries = 10;
    while (retries > 0) {
      try {
        await this.db.selectFrom('collections').select('id').limit(1).execute();
        return;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error('Could not connect to test database after 10 retries');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}