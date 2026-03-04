# Cosmic Dolphin Shared Package

This package contains shared utilities, types, database schemas, repositories, and services used across the Cosmic Dolphin project.

## Architecture

- **Database Layer**: Kysely query builder with PostgreSQL
- **Repository Layer**: Type-safe data access with error handling
- **Service Layer**: Business logic built on top of repositories
- **Types**: Shared TypeScript interfaces and types

## Testing

### Prerequisites

- Bun
- A Supabase project for testing (with migrations applied via `supabase db push`)

### Configuration

Tests require a `DATABASE_URL` environment variable pointing to a Supabase database.

Set it in the project root `.env.test`:
```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres
NODE_ENV=test
```

> **WARNING**: Tests truncate tables between runs. Never point this at a production database.

### Running Tests

```bash
# From the project root
bun run test --filter=@cosmic-dolphin/shared

# Or from the shared package directory
cd packages/shared
bun run test

# Run tests with coverage
bun run test:coverage

# Run tests in watch mode
bun run test:watch
```

### Applying Migrations

Migrations live in `supabase/migrations/` and are applied to Supabase projects via the Supabase CLI:

```bash
# Link to your Supabase project (one-time setup)
supabase link --project-ref <your-project-ref>

# Push pending migrations
supabase db push
```

In CI, this happens automatically before tests run.

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
1. Push migrations to your test project: `supabase db push`
2. Update Kysely schema types in `src/database/schema.ts`
3. Update repositories if needed
4. Add corresponding tests

### Debugging Tests

- Run single test: `bun run test -- --testNamePattern="specific test name"`
- Check Supabase dashboard for query logs and table state
