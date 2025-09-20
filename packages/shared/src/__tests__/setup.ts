import { config } from 'dotenv';
import { join } from 'path';
import { getTestDatabase, DatabaseTestUtils, closeTestDatabase } from '../test-utils/database';

// Load test environment variables
config({ path: join(__dirname, '../../.env.test') });

let dbUtils: DatabaseTestUtils | null = null;

beforeAll(async () => {
  // Initialize test database connection
  const db = getTestDatabase();
  dbUtils = new DatabaseTestUtils(db);

  // Wait for database to be ready
  await dbUtils.waitForConnection();

  console.log('Test database connected successfully');
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