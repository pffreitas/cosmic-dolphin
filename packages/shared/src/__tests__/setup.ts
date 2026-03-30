import { config } from 'dotenv';
import { join } from 'path';
import { getTestDatabase, DatabaseTestUtils, closeTestDatabase } from '../test-utils/database';

// Load .env.test for local development; in CI, env vars are injected by the workflow.
config({ path: join(process.cwd(), '.env.test') });

let dbUtils: DatabaseTestUtils | null = null;

beforeAll(async () => {
  // Skip database setup when DATABASE_URL is not configured (e.g. pure unit tests)
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const db = getTestDatabase();
    dbUtils = new DatabaseTestUtils(db);
    await dbUtils.waitForConnection();
    console.log('Test database connected successfully');
  } catch (error) {
    console.warn('Test database unavailable — skipping DB setup. Integration tests will be skipped.');
    dbUtils = null;
  }
});

beforeEach(async () => {
  // Clean database before each test
  if (dbUtils) {
    await dbUtils.truncateAll();
  }
});

afterAll(async () => {
  // Close database connection after all tests
  await closeTestDatabase();
  console.log('Test database connection closed');
});

// Make dbUtils available globally for tests
declare global {
  var testDbUtils: DatabaseTestUtils | null;
}

global.testDbUtils = dbUtils;