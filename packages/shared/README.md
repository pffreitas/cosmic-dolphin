# Cosmic Dolphin Shared Package

This package contains shared utilities, types, database schemas, repositories, and services used across the Cosmic Dolphin project.

## Architecture

- **Database Layer**: Kysely query builder with PostgreSQL
- **Repository Layer**: Type-safe data access with error handling
- **Service Layer**: Business logic built on top of repositories
- **Types**: Shared TypeScript interfaces and types

## Testing

### Prerequisites

- Bun and Docker
- No Supabase project, CLI, account, or test database secret

### Running Tests

```bash
# From the project root: start a disposable Postgres on port 5433, apply migrations,
# then run the API, worker, and shared suites.
bun run apispec:compile
COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:up
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:reset
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run test:backend -- --env-mode=loose --concurrency=1

# On subsequent runs, while the container and schema are still in place:
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run test:backend -- --env-mode=loose --concurrency=1

# Apply new migrations or rebuild the schema after changing migrations:
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres NODE_ENV=test COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:reset

# Only when no other task owns this disposable database:
COMPOSE_PROJECT_NAME=cosmic-dolphin bun run db:test:down
```

`docker-compose.test.yml` uses `supabase/postgres:15.19.0.004` because the migrations
require pgvector, pgroonga, and the `auth` schema shipped in that image. This is
one Postgres container, **not** the full Supabase CLI stack. The reset script
applies `supabase/migrations/*.sql` directly, without linking a hosted project.

The test URL defaults to `postgres://postgres:postgres@127.0.0.1:5433/postgres`.
You do not need `.env.test`; copy `.env.test.example` only if overriding the
local connection. Tests truncate **all** tables in `public` before each test.
The harness refuses a nonlocal host (unless explicitly overridden) and a
database without the reset script's `__test_database_marker` table. Never point
it at a database containing data you want to keep.

Shared, API and worker suites share this truncating database. Run them serially; do not run native/API fixtures concurrently. `DATABASE_URL` only controls SQL clients, not Supabase SDK/pgmq RPC transport. Isolate both before worker fixture proof. See the [release runbook](../../docs/runbooks/backend-and-testflight-release.md) for the exact fresh-checkout gate and Docker isolation.

From `packages/shared`, run `bun run test` for the package suite, or
`bun run test -- --testPathPatterns=<pattern>` for one Jest suite. The container
must be running and migrated for the database-backed tests.

Production migrations remain separate: `bun run db:migrate` still uses the
Supabase CLI against the linked production project. CI starts a disposable
container for tests; only the deployment migration job needs a Supabase token.

### Test Structure

```
src/
├── __tests__/
│   ├── setup.ts              # Global test setup
│   └── repositories/         # Repository tests
│       ├── base.repository.test.ts
│       ├── bookmark.repository.test.ts
│       └── collection.repository.test.ts
├── test-utils/
│   ├── database.ts           # Database utilities
│   ├── factories.ts          # Test data factories
│   └── index.ts
└── ...
```

### Writing Tests

#### Using Test Factories

```typescript
import { TestDataFactory } from '../test-utils/factories';

// Create test data
const bookmark = TestDataFactory.createBookmark({
  user_id: 'test-user',
  source_url: 'https://example.com',
});

const collection = TestDataFactory.createCollection({
  user_id: 'test-user',
  name: 'My Collection',
});
```

#### Database Operations

```typescript
import { getTestDatabase } from '../test-utils/database';

const db = getTestDatabase();
const repository = new BookmarkRepositoryImpl(db);

// Test CRUD operations
const created = await repository.create(bookmarkData);
const found = await repository.findByIdAndUser(created.id, userId);
```

## Repository Testing Coverage

### BookmarkRepository
- ✅ Create bookmarks with all fields
- ✅ Find by user and URL
- ✅ Find by ID and user
- ✅ Find by user with filtering (collection, archived, pagination)
- ✅ Update bookmark properties
- ✅ Delete bookmarks
- ✅ Insert scraped URL contents

### CollectionRepository
- ✅ Create collections with hierarchy support
- ✅ Find by ID and user
- ✅ Find by user (ordered by creation date)
- ✅ Update collection properties
- ✅ Delete collections
- ✅ Error handling

### BaseRepository
- ✅ Error handling and wrapping
- ✅ Query execution patterns
- ✅ Type safety preservation

## Development

### Adding New Tests

1. Create test files in `src/__tests__/`
2. Use existing factories or create new ones in `test-utils/factories.ts`
3. Follow existing patterns for database setup/cleanup
4. Run tests to ensure they pass

### Database Schema Changes

When Supabase migrations are added:

1. Apply migrations to the disposable local database with `bun run db:test:reset` and explicit local test environment values. Coordinate ownership first; this resets data.
2. Update Kysely schema types in `src/database/schema.ts`
3. Update repositories if needed
4. Add corresponding tests

### Debugging Tests

- Run single test: `bun run test -- --testNamePattern="specific test name"`
- Inspect disposable-container logs and local query state. Never use a hosted business database as the truncating test target.
