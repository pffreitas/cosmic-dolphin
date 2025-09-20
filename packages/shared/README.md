# Cosmic Dolphin Shared Package

This package contains shared utilities, types, database schemas, repositories, and services used across the Cosmic Dolphin project.

## Architecture

- **Database Layer**: Kysely query builder with PostgreSQL
- **Repository Layer**: Type-safe data access with error handling
- **Service Layer**: Business logic built on top of repositories
- **Types**: Shared TypeScript interfaces and types

## Testing

### Prerequisites

- Docker (for test database)
- Node.js/Bun
- PostgreSQL (via Docker)

### Running Tests

**Important**: All test commands must be run from the `packages/shared` directory.

```bash
# Navigate to the shared package
cd packages/shared

# Start the test database
bun run test:db:up

# Run tests
bun run test

# Run tests with coverage
bun run test:coverage

# Run tests in watch mode
bun run test:watch

# Stop the test database
bun run test:db:down

# Reset the test database (stop + start)
bun run test:db:reset
```

**Alternative**: Run from project root using workspace commands:
```bash
# From project root
cd /path/to/cosmic-dolphin

# Run tests in shared package
bun run --cwd packages/shared test

# Start test database
bun run --cwd packages/shared test:db:up
```

### Test Database

The test database runs in Docker using the same Supabase migrations as production. This ensures:

- **Schema Consistency**: Tests run against the exact same schema as production
- **Migration Testing**: Migrations are tested as part of the setup process
- **Isolation**: Each test run starts with a clean database state

#### Configuration

Test database configuration is in `.env.test`:
- Database: `cosmic_dolphin_test`
- User: `test_user`
- Password: `test_password`
- Port: `5433` (to avoid conflicts with local PostgreSQL)

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

### Migration Testing

The test database automatically runs all Supabase migrations during initialization:

1. Docker starts PostgreSQL container
2. Init script (`init-test-db.sh`) executes all `.sql` files from `supabase/migrations/`
3. Migrations run in timestamp order (e.g., `20250908222056_*.sql`)
4. Database is ready for testing

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
1. Tests automatically pick up new schema changes
2. Update Kysely schema types in `src/database/schema.ts`
3. Update repositories if needed
4. Add corresponding tests

### Debugging Tests

- Check Docker logs: `docker-compose -f ../../docker-compose.test.yml logs`
- Verify database connection: `bun run test:db:up && docker exec cosmic-dolphin-test-db psql -U test_user -d cosmic_dolphin_test -c "\dt"`
- Run single test: `bun run test -- --testNamePattern="specific test name"`