import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  getTestDatabase,
  getTestDatabaseUrl,
  DatabaseTestUtils,
  closeTestDatabase,
} from '../test-utils/database';

// `.env.test` is optional: `getTestDatabaseUrl()` defaults to the local container
// from docker-compose.test.yml. It exists for overriding the port or credentials,
// not for holding a hosted connection string — see .env.test.example.
[
  join(process.cwd(), '.env.test'),
  join(process.cwd(), '../../.env.test'),
].forEach((envPath) => {
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
});

let dbUtils: DatabaseTestUtils | null = null;

beforeAll(async () => {
  // No try/catch. An unreachable database used to be swallowed with a warning
  // that integration tests "will be skipped" — but the suites call
  // getTestDatabase() directly, so they errored anyway, and the per-test
  // TRUNCATE was silently skipped so rows leaked between the tests that did
  // run. A missing database is a broken environment, and it should say so once,
  // clearly, instead of failing 50 assertions for reasons of its own.
  const db = getTestDatabase();
  dbUtils = new DatabaseTestUtils(db);
  await dbUtils.waitForConnection();
  console.log(`Test database connected: ${new URL(getTestDatabaseUrl()).host}`);
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
});

// Make dbUtils available globally for tests
declare global {
  var testDbUtils: DatabaseTestUtils | null;
}

global.testDbUtils = dbUtils;
