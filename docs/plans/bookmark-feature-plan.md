# Bookmark Feature Development Plan

## Overview
This plan outlines the implementation of a comprehensive bookmark management system with URL processing, metadata extraction, and background processing capabilities.

## Feature Requirements

### Core Entities
- **Bookmark**: URL bookmarking with metadata, summary, and content
- **Collection**: Hierarchical organization of bookmarks
- **Tags**: Many-to-many tagging system for bookmarks

### API Requirements
- REST endpoint: `POST /api/v1/bookmarks`
- Input: `source_url` (required), `collection_id` (optional)
- URL validation and reachability check
- Open Graph metadata extraction
- Background processing via message queue

## Implementation Phases

### Phase 1: Database Schema & Types (Priority: High)
**Estimated Time**: 2-3 hours

#### Tasks:
1. **Update Shared Types** (`packages/shared/src/types.ts`)
   - Add `OpenGraphMetadata` interface
   - Add `BookmarkMetadata` interface
   - Add `Bookmark` interface extending `BaseEntity`
   - Add `Collection` interface extending `BaseEntity`
   - Add `BookmarkTag` interface
   - Add `BookmarkQueuePayload` interface

2. **Create Database Migrations** (`supabase/migrations/`)
   - `20250908223001_create_collections_table.sql`
   - `20250908223002_create_bookmarks_table.sql`
   - `20250908223003_create_bookmark_tags_table.sql`
   - `20250908223004_create_bookmarks_queue.sql`

3. **Apply Migrations**
   - Run migrations in Supabase
   - Verify table creation and indexes
   - Test RLS policies (if applicable)

#### Acceptance Criteria:
- [ ] All TypeScript interfaces defined and exported
- [ ] Database tables created with proper relationships
- [ ] Indexes created for performance
- [ ] Bookmarks queue created in PGMQ

### Phase 2: API Endpoint Implementation (Priority: High)
**Estimated Time**: 4-5 hours

#### Tasks:
1. **Install Dependencies**
   ```bash
   cd packages/api
   npm install cheerio @types/cheerio
   ```

2. **Create Bookmark Routes** (`packages/api/src/routes/bookmarks.ts`)
   - URL validation logic
   - HTTP fetch with timeout and error handling
   - Content type validation
   - Open Graph metadata extraction using Cheerio
   - Database insertion logic
   - Queue message posting

3. **Register Routes** (`packages/api/src/index.ts`)
   - Import and register bookmark routes with `/api/v1` prefix

4. **Environment Variables**
   - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured
   - Add any additional configuration needed

#### Acceptance Criteria:
- [ ] `POST /api/v1/bookmarks` endpoint functional
- [ ] URL validation rejects invalid/unreachable URLs
- [ ] Open Graph tags extracted and stored in metadata
- [ ] Bookmark created in database with proper relationships
- [ ] Message posted to bookmarks queue
- [ ] Proper error handling for all failure scenarios
- [ ] Endpoint returns appropriate HTTP status codes

### Phase 3: Queue Handler Implementation (Priority: Medium)
**Estimated Time**: 3-4 hours

#### Tasks:
1. **Create Bookmark Handler** (`packages/worker/src/queue/handlers/bookmark-processor.handler.ts`)
   - Implement `MessageHandlerInterface`
   - Basic message validation and routing
   - Skeleton processing logic with logging
   - Error handling and retry logic

2. **Register Handler** (`packages/worker/src/queue/queue.module.ts`)
   - Add `BookmarkProcessorHandler` to providers
   - Configure handler routing for bookmark messages

3. **Update Queue Processor** (`packages/worker/src/queue/queue.processor.ts`)
   - Add bookmark queue processing
   - Route messages to appropriate handler

#### Acceptance Criteria:
- [ ] Bookmark messages consumed from queue
- [ ] Handler processes messages without errors
- [ ] Proper logging for debugging
- [ ] Messages archived after successful processing
- [ ] Failed messages handled appropriately

### Phase 4: Testing & Validation (Priority: Medium)
**Estimated Time**: 2-3 hours

#### Tasks:
1. **Unit Tests**
   - Test Open Graph extraction logic
   - Test URL validation
   - Test error handling scenarios

2. **Integration Tests**
   - End-to-end bookmark creation flow
   - Queue message processing
   - Database operations

3. **Manual Testing**
   - Test with various URL types (articles, videos, PDFs)
   - Test error scenarios (404, timeout, invalid content)
   - Test queue processing and monitoring

#### Acceptance Criteria:
- [ ] All tests passing
- [ ] Manual testing completed successfully
- [ ] Error scenarios handled gracefully
- [ ] Performance acceptable for typical URLs

### Phase 5: Enhanced Processing (Priority: Low)
**Estimated Time**: 8-12 hours (Future work)

#### Future Enhancements:
1. **Content Analysis**
   - Full content extraction using readability algorithms
   - Text summarization using LLM integration
   - Automatic tag suggestion based on content

2. **Advanced Metadata**
   - Extract additional metadata (author, publish date, etc.)
   - Support for different content types (PDFs, videos)
   - Social media metadata extraction

3. **Content Archiving**
   - Store full page content for offline access
   - Handle dynamic content and SPAs
   - Image and asset archiving

## Technical Dependencies

### External Libraries
- `cheerio`: HTML parsing and DOM manipulation
- `@supabase/supabase-js`: Database and queue operations
- `@types/cheerio`: TypeScript definitions

### Environment Requirements
- Node.js 18+
- Supabase with PGMQ extension
- Network access for URL fetching

## Risk Assessment

### High Risk
- **URL Fetching Reliability**: Some websites may block automated requests
  - Mitigation: Implement proper User-Agent headers, retry logic, and rate limiting

### Medium Risk
- **Content Type Variations**: Not all websites return clean HTML
  - Mitigation: Robust content type checking and error handling

### Low Risk
- **Queue Processing Delays**: Background processing may accumulate backlog
  - Mitigation: Monitor queue depth and processing times

## Monitoring & Observability

### Metrics to Track
- Bookmark creation success/failure rates
- URL fetch response times and error rates
- Queue processing latency
- Open Graph extraction success rates

### Logging Requirements
- All API requests and responses
- URL fetch attempts and results
- Queue message processing events
- Error details for debugging

## Deployment Considerations

### Database
- Run migrations in production environment
- Verify queue creation and permissions
- Monitor table performance and indexes

### API
- Deploy updated API service
- Update environment variables
- Monitor endpoint performance

### Worker
- Deploy updated worker service
- Verify queue connectivity
- Monitor processing performance

## Success Criteria

### Functional
- [ ] Users can create bookmarks with just a URL
- [ ] Open Graph metadata extracted and stored
- [ ] Background processing queue functional
- [ ] Collections and tags support implemented

### Non-Functional
- [ ] API responds within 5 seconds for typical URLs
- [ ] Queue processing handles 100+ bookmarks/minute
- [ ] 99%+ success rate for reachable URLs
- [ ] Graceful error handling for unreachable content

### User Experience
- [ ] Clear error messages for invalid URLs
- [ ] Fast bookmark creation (< 3 seconds)
- [ ] Reliable metadata extraction
- [ ] Organized bookmark storage with collections

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database & Types | 2-3 hours | None |
| Phase 2: API Implementation | 4-5 hours | Phase 1 complete |
| Phase 3: Queue Handler | 3-4 hours | Phase 1 complete |
| Phase 4: Testing | 2-3 hours | Phases 2-3 complete |
| **Total Estimated Time** | **11-15 hours** | |

## Next Steps

1. Begin with Phase 1 (Database Schema & Types)
2. Set up development environment with required dependencies
3. Create feature branch for development
4. Implement phases sequentially with testing between each
5. Deploy to staging environment for validation
6. Plan Phase 5 enhancements based on user feedback