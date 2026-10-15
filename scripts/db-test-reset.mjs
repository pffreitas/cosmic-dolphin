/**
 * Rebuild the local test database from `supabase/migrations/`.
 *
 * This replaces `supabase link && supabase db push` against a hosted project.
 * The container in `docker-compose.test.yml` runs the same `supabase/postgres`
 * image Supabase does, so every migration applies unmodified — including the
 * ones that need pgroonga, pgvector, the `auth` schema or the `authenticated`
 * role. Nothing here shims the platform; it only loads the schema.
 *
 *   bun run db:test:up && bun run db:test:reset
 *
 * Connects as `supabase_admin`: `postgres` is not a superuser in this image, so
 * the unguarded `CREATE EXTENSION vector` in
 * `20260303000002_add_vector_search.sql` fails as any other role.
 */
import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ADMIN_URL =
  process.env.TEST_DB_ADMIN_URL ??
  "postgres://supabase_admin:postgres@127.0.0.1:5433/postgres";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "supabase", "migrations");

/**
 * The sentinel `packages/shared/src/test-utils/database.ts` looks for before it
 * will TRUNCATE anything. A database without this table is not a test database.
 */
const MARKER_TABLE = "__test_database_marker";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * This script drops `public`, so its target must be the exact local container
 * (or an explicitly opted-in disposable database in CI). A localhost tunnel to
 * a real project must not silently pass a loopback-only check.
 */
function assertTestTarget(url) {
  if (process.env.TEST_DB_ALLOW_NONLOCAL === "1") return;

  const target = new URL(url);
  if (
    LOOPBACK.has(target.hostname) &&
    target.port === "5433" &&
    target.pathname === "/postgres" &&
    target.username === "supabase_admin"
  ) return;

  throw new Error(
    `Refusing to reset a database at ${target.host}${target.pathname}: ` +
      `this drops the public schema. Expected the local test container on ` +
      `port 5433, database postgres, user supabase_admin. Set ` +
      `TEST_DB_ALLOW_NONLOCAL=1 only for a disposable database in CI.`,
  );
}

async function main() {
  assertTestTarget(ADMIN_URL);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
  }

  const client = new Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Could not connect to the test database at ${new URL(ADMIN_URL).host}.\n` +
        `Start it with: bun run db:test:up\n\n${error.message}`,
    );
  }

  try {
    // Only `public`. `auth`, `pgmq`, `extensions` and `vault` belong to the
    // image, and dropping `auth` would take `auth.uid()` and `auth.users` with
    // it — the very things that make the migrations apply as written.
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query(
      "GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role",
    );
    await client.query("GRANT ALL ON SCHEMA public TO postgres, supabase_admin");

    // Recreating `public` discards the default privileges the image's init
    // scripts set on it, which is how tables end up owned by `supabase_admin`
    // with nothing granted to `postgres` — and TRUNCATE then fails with
    // "permission denied for table collections". Re-declare them before the
    // migrations run so every table they create is reachable by the role the
    // tests connect as.
    for (const kind of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public
         GRANT ALL ON ${kind} TO postgres, anon, authenticated, service_role`,
      );
    }

    await client.query("CREATE SCHEMA IF NOT EXISTS supabase_migrations");
    await client.query(`
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text PRIMARY KEY,
        statements text[],
        name text
      )
    `);
    // Same ledger the Supabase CLI writes, so `scripts/check-migration-drift.mjs`
    // works against this database too.
    await client.query("TRUNCATE supabase_migrations.schema_migrations");

    for (const file of files) {
      const version = file.split("_")[0];
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

      // One transaction per file, and no catch: a half-applied schema produces
      // failures far away from their cause, which is how the previous setup
      // managed to look like a flaky test suite.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
           VALUES ($1, $2, ARRAY[$3]::text[])
           ON CONFLICT (version) DO NOTHING`,
          [version, file, sql],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed:\n${error.message}`);
      }
    }

    await client.query(
      `CREATE TABLE ${MARKER_TABLE} (
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await client.query(`INSERT INTO ${MARKER_TABLE} DEFAULT VALUES`);

    // Belt and braces: the default privileges above cover tables created by
    // this connection, but a migration running as a different role or through a
    // SECURITY DEFINER function would slip past them.
    for (const kind of ["TABLES", "SEQUENCES", "FUNCTIONS"]) {
      await client.query(
        `GRANT ALL ON ALL ${kind} IN SCHEMA public
         TO postgres, anon, authenticated, service_role`,
      );
    }

    console.log(`Applied ${files.length} migrations to ${new URL(ADMIN_URL).host}.`);
  } finally {
    await client.end();
  }
}

await main();
