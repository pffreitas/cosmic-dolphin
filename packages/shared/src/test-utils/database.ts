import { Kysely, sql } from 'kysely';
import { Database } from '../database/schema';
import { createDatabase } from '../database/connection';

/**
 * The local container from `docker-compose.test.yml`. Defaulting means a fresh
 * checkout runs the suite with no env file at all — the old behaviour was to
 * throw, which pushed everyone towards pasting a hosted connection string into
 * `.env.test`, and TRUNCATE does not care whether that string is a test project.
 */
const DEFAULT_TEST_DATABASE_URL =
  'postgres://postgres:postgres@127.0.0.1:5433/postgres';

/** Written by `scripts/db-test-reset.mjs`. No marker, no TRUNCATE. */
const MARKER_TABLE = '__test_database_marker';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

let testDb: Kysely<Database> | null = null;
let truncateAllowed = false;

export function getTestDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

/**
 * Checked before connecting, not just before truncating, so a stale `.env.test`
 * left over from the hosted-Supabase era says so immediately instead of spending
 * ten retries on DNS and then blaming the container.
 */
function assertLocalHost(url: string): void {
  const host = new URL(url).hostname;
  const target = new URL(url);
  if (
    process.env.TEST_DB_ALLOW_NONLOCAL === '1' ||
    (LOOPBACK_HOSTS.has(host) &&
      target.port === '5433' &&
      target.pathname === '/postgres' &&
      target.username === 'postgres')
  ) {
    return;
  }

  throw new Error(
    `DATABASE_URL points at "${target.host}${target.pathname}", not the ` +
      `local test container on port 5433 (database postgres, user postgres).\n` +
      `Run: bun run db:test:up && bun run db:test:reset\n` +
      `Delete the DATABASE_URL line from .env.test, or set ` +
      `TEST_DB_ALLOW_NONLOCAL=1 if this really is a disposable database in CI.`,
  );
}

export function getTestDatabase(): Kysely<Database> {
  if (!testDb) {
    const url = getTestDatabaseUrl();
    assertLocalHost(url);
    testDb = createDatabase(url);
  }
  return testDb;
}

/**
 * Three independent checks, all of which must pass before anything is deleted.
 *
 * `clearDatabase` truncates every table in `public`. It used to run against
 * whatever `DATABASE_URL` happened to hold, which for a long time was a live
 * Supabase pooler credential — one stale env file away from emptying a real
 * database. The marker table is the load-bearing check: it exists only because
 * the reset script created it, so it cannot be true of a database this harness
 * did not build.
 */
async function assertDisposable(db: Kysely<Database>): Promise<void> {
  if (truncateAllowed) return;

  const url = getTestDatabaseUrl();

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Refusing to clear the database: NODE_ENV is "${process.env.NODE_ENV}", not "test".`,
    );
  }

  assertLocalHost(url);

  const marker = await sql<{ present: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${MARKER_TABLE}
    ) AS present
  `.execute(db);

  if (!marker.rows[0]?.present) {
    throw new Error(
      `Refusing to clear a database without the "${MARKER_TABLE}" table — it is ` +
        `not a test database built by scripts/db-test-reset.mjs.\n` +
        `Run: bun run db:test:up && bun run db:test:reset`,
    );
  }

  truncateAllowed = true;
}

/**
 * Truncates every table in `public`, discovered at runtime.
 *
 * Deliberately not a hand-maintained list: the previous one named 9 of the 22
 * tables the migrations create, so rows leaked between tests on everything added
 * since it was written. No migration seeds a row, so there is nothing to
 * preserve. One statement, so FK order does not matter.
 */
export async function clearDatabase(db: Kysely<Database>): Promise<void> {
  await assertDisposable(db);

  const tables = await sql<{ qualified: string }>`
    SELECT format('%I.%I', schemaname, tablename) AS qualified
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> ${MARKER_TABLE}
  `.execute(db);

  if (tables.rows.length === 0) {
    throw new Error(
      'The test database has no tables in "public". Run: bun run db:test:reset',
    );
  }

  const list = tables.rows.map((row) => row.qualified).join(', ');
  await sql.raw(`TRUNCATE ${list} CASCADE`).execute(db);
}

export async function closeTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.destroy();
    testDb = null;
    truncateAllowed = false;
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
          throw new Error(
            `Could not reach the test database at ${new URL(getTestDatabaseUrl()).host} ` +
              `after 10 retries.\n` +
              `Start it and load the schema with:\n` +
              `  bun run db:test:up && bun run db:test:reset\n\n` +
              `Last error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}
