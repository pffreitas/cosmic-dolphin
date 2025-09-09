# Bookmarks API Refactoring Plan

## Overview
Refactor `packages/api/src/routes/bookmarks.ts` to improve code organization, type safety, and maintainability by extracting services and using shared types.

## Current Issues
1. **Type Safety**: Using `any` types and local interfaces instead of shared types
2. **Service Coupling**: Direct database operations and utility functions embedded in route handlers
3. **Code Duplication**: Utility functions that could be shared across the application
4. **Separation of Concerns**: Business logic mixed with HTTP handling

## Refactoring Goals
1. Use types from `@packages/shared/src/types.ts`
2. Create `WebScrapingService` for web scraping operations
3. Create shared queue service for message posting
4. Create database services per entity (Bookmark, Collection)

## Implementation Plan

### Phase 1: Update Shared Types
**File**: `packages/shared/src/types.ts`

Add missing request/response types:
```typescript
// API Request/Response types
export interface CreateBookmarkRequest {
  source_url: string;
  collection_id?: string;
  user_id: string;
}

export interface CreateBookmarkResponse {
  bookmark: Bookmark;
  message: string;
}

export interface GetBookmarksQuery {
  user_id: string;
  collection_id?: string;
  limit?: number;
  offset?: number;
}

export interface GetBookmarksResponse {
  bookmarks: Bookmark[];
}

// Service result types
export interface FetchUrlResult {
  content: string;
  contentType: string;
}

export interface ValidationError {
  field: string;
  message: string;
}
```

### Phase 2: Create WebScrapingService
**File**: `packages/shared/src/services/web-scraping.service.ts`

```typescript
import { OpenGraphMetadata, BookmarkMetadata, FetchUrlResult } from '../types';

export interface WebScrapingService {
  isValidUrl(url: string): boolean;
  validateAndFetchUrl(url: string): Promise<FetchUrlResult>;
  extractOpenGraphMetadata(html: string): OpenGraphMetadata;
  createBookmarkMetadata(ogData: OpenGraphMetadata, contentType: string, html: string): BookmarkMetadata;
}

export class WebScrapingServiceImpl implements WebScrapingService {
  // Implementation details...
}
```

**Features to implement:**
- URL validation with proper error types
- HTTP fetching with timeout and proper headers
- Open Graph metadata extraction using cheerio
- Bookmark metadata creation (word count, reading time, favicon)
- Proper error handling and logging

### Phase 3: Create Queue Service
**File**: `packages/shared/src/services/queue.service.ts`

```typescript
import { QueueTaskPayload } from '../types';

export interface QueueService {
  sendMessage<T extends QueueTaskPayload>(queueName: string, payload: T, delay?: number): Promise<void>;
  sendBookmarkProcessingMessage(bookmarkId: string, sourceUrl: string, userId: string, collectionId?: string): Promise<void>;
}

export class QueueServiceImpl implements QueueService {
  // Implementation using Supabase pgmq functions
}
```

**Features to implement:**
- Generic message sending to any queue
- Specific bookmark processing message helper
- Error handling and retry logic
- Logging integration

### Phase 4: Create Database Services
**File**: `packages/shared/src/services/bookmark.service.ts`

```typescript
import { Bookmark, CreateBookmarkRequest } from '../types';

export interface BookmarkService {
  findByUserAndUrl(userId: string, sourceUrl: string): Promise<Bookmark | null>;
  create(data: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Bookmark>;
  findByUser(userId: string, options?: {
    collectionId?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  }): Promise<Bookmark[]>;
  update(id: string, data: Partial<Bookmark>): Promise<Bookmark>;
  delete(id: string): Promise<void>;
}

export class BookmarkServiceImpl implements BookmarkService {
  // Implementation using Supabase client
}
```

**File**: `packages/shared/src/services/collection.service.ts`

```typescript
import { Collection } from '../types';

export interface CollectionService {
  findByIdAndUser(id: string, userId: string): Promise<Collection | null>;
  findByUser(userId: string): Promise<Collection[]>;
  create(data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collection>;
  update(id: string, data: Partial<Collection>): Promise<Collection>;
  delete(id: string): Promise<void>;
}

export class CollectionServiceImpl implements CollectionService {
  // Implementation using Supabase client
}
```

### Phase 5: Create Service Container
**File**: `packages/shared/src/services/index.ts`

```typescript
export * from './web-scraping.service';
export * from './queue.service';
export * from './bookmark.service';
export * from './collection.service';

// Service factory for dependency injection
export interface ServiceContainer {
  webScraping: WebScrapingService;
  queue: QueueService;
  bookmark: BookmarkService;
  collection: CollectionService;
}

export function createServiceContainer(supabaseClient: any): ServiceContainer {
  return {
    webScraping: new WebScrapingServiceImpl(),
    queue: new QueueServiceImpl(supabaseClient),
    bookmark: new BookmarkServiceImpl(supabaseClient),
    collection: new CollectionServiceImpl(supabaseClient),
  };
}
```

### Phase 6: Refactor Bookmarks Route Handler
**File**: `packages/api/src/routes/bookmarks.ts`

**Key Changes:**
1. Remove all inline utility functions
2. Remove local interfaces - use shared types
3. Inject services through dependency injection
4. Simplify route handlers to focus on HTTP concerns
5. Add proper error mapping from service errors to HTTP responses

**New Structure:**
```typescript
import { FastifyInstance } from "fastify";
import { 
  CreateBookmarkRequest, 
  CreateBookmarkResponse, 
  GetBookmarksQuery,
  GetBookmarksResponse,
  ServiceContainer 
} from "@packages/shared";

export default async function bookmarkRoutes(
  fastify: FastifyInstance, 
  services: ServiceContainer
) {
  // POST /bookmarks - simplified to ~50 lines
  // GET /bookmarks - simplified to ~30 lines
}
```

## Migration Steps

### Step 1: Prepare Infrastructure
1. Add new types to `packages/shared/src/types.ts`
2. Create service interfaces and implementations
3. Update `packages/shared/package.json` dependencies (add cheerio, etc.)
4. Export new services from shared package

### Step 2: Update API Package
1. Install shared package dependency in API
2. Create service container initialization
3. Refactor bookmark routes to use services
4. Remove old utility functions and local types
5. Update imports

### Step 3: Testing
1. Update existing tests to mock services
2. Add unit tests for new services
3. Run integration tests to ensure functionality

### Step 4: Worker Package Updates
1. Update worker to use shared services where applicable
2. Ensure consistent queue message handling

## Benefits After Refactoring

1. **Type Safety**: Consistent types across packages
2. **Testability**: Services can be easily mocked
3. **Reusability**: Services can be used in worker package
4. **Maintainability**: Clear separation of concerns
5. **Error Handling**: Consistent error patterns
6. **Scalability**: Easy to add new features or modify existing ones

## Dependencies
- `cheerio` for HTML parsing (move to shared package)
- `@supabase/supabase-js` (already available)
- Proper TypeScript configuration for shared package imports

## Timeline
- **Phase 1-2**: 2-3 hours (types and web scraping service)
- **Phase 3-4**: 2-3 hours (queue and database services)  
- **Phase 5-6**: 2-3 hours (integration and refactoring)
- **Testing**: 1-2 hours
- **Total**: ~8-10 hours

## Risk Assessment
- **Low Risk**: Types and service interfaces
- **Medium Risk**: Database service implementation (need to maintain exact same behavior)
- **Medium Risk**: Queue service (ensure message format compatibility)
- **Testing Required**: All bookmark operations to ensure no regressions