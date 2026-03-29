import { config } from 'dotenv';
import { join } from 'path';
import { getTestDatabase, DatabaseTestUtils, closeTestDatabase } from '../test-utils/database';

// Load .env.test for local development; in CI, env vars are injected by the workflow.
config({ path: join(process.cwd(), '.env.test') });

let dbUtils: DatabaseTestUtils | null = null;

const SKIP_DB = process.env.SKIP_DB === 'true';

beforeAll(async () => {
  if (SKIP_DB) {
    console.log('Skipping test database connection (SKIP_DB=true)');
    return;
  }

  // Initialize test database connection
  const db = getTestDatabase();
  dbUtils = new DatabaseTestUtils(db);

  // Wait for database to be ready
  await dbUtils.waitForConnection();

  console.log('Test database connected successfully');
});

beforeEach(async () => {
  if (SKIP_DB) {
    return;
  }

  // Clean database before each test
  if (dbUtils) {
    await dbUtils.truncateAll();
  }
});

afterAll(async () => {
  if (SKIP_DB) {
    return;
  }

  // Close database connection after all tests
  await closeTestDatabase();
  console.log('Test database connection closed');
});

// Make dbUtils available globally for tests
declare global {
  var testDbUtils: DatabaseTestUtils | null;
}

global.testDbUtils = dbUtils;
