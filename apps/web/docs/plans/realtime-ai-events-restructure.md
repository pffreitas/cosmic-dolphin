# Realtime AI Events Data Structure Restructure

## Overview

Restructure the frontend realtime slice to properly handle AI session events from the backend, implementing a hierarchical Session -> Message -> Part structure that matches the backend AI processing pipeline.

## Current State

The existing `realtimeSlice.ts` uses a flat structure focused on bookmarks and tasks, which doesn't align with the backend's AI event system that streams text, tool calls, and usage data in parts.

## Target Architecture

### Data Structure

```typescript
Session {
  sessionID: string
  refId: string (bookmark id)
  tasks: Record<taskID, Task>
  eventsReceivedCount: number
  lastReceivedEventTimestamp: number
  usage: LLMUsage
}

Task {
  taskID: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  subTasks: Record<string, SubTask>;
  messages: Record<messageID, Message>
}

SubTask {
  taskID: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  messages: Record<messageID, Message>
}

Message {
  sessionID: string
  messageID: string
  taskID: string
  parts: Record<partID, MessagePart>
}

interface BaseMessagePart {
  partID: string;
  type: "text" | "tool";
}

MessagePart = TextPart | ToolPart

interface TextPart extends BaseMessagePart {
   partID: string
   type: "text";
   text: string;
}

interface ToolPart extends BaseMessagePart {
   partID: string
   type: "tool";
   toolName: string;
   callID: string;
   status: "pending" | "running" | "completed" | "error";
   input: string;
   output: string;
   metadata: Record<string, any>;
   title: string;
}

interface LLMUsage  {
   inputTokens?: number;
   outputTokens?: number;
   totalTokens?: number;
   reasoningTokens?: number;
   cachedInputTokens?: number;
}

```

### Event Handling

- `session.error`
- `message.updated`
- `message.part.updated`
- `bookmark.updated`
- `task.started`
- `task.updated`
- `task.completed`
- `task.failed`
- Maintain backward compatibility with existing bookmark/task events

## Implementation Plan

### Phase 1: Type Definitions & State Structure

**Duration: 1-2 hours**

1. **Update type definitions** (`lib/types/realtime.ts`)

   - Define Session interface with `refId` (bookmark id), session-level `LLMUsage`, and event tracking
   - Define Message interface with simplified structure (sessionID, messageID, taskID, parts only)
   - Define TextPart interface with `partID`, `type`, and `text` fields
   - Define ToolPart interface with comprehensive fields: `partID`, `type`, `toolName`, `callID`, `status`, `input`, `output`, `metadata`, `title`
   - Define BaseMessagePart interface for shared part properties
   - Keep existing Task/SubTask interfaces as-is for backward compatibility
   - Add LLMUsage interface with optional token fields including reasoning and cached tokens
   - Add union types for event payloads and MessagePart types

2. **Restructure realtime state** (`lib/store/slices/realtimeSlice.ts`)

   **Current RealtimeState:**
   ```typescript
   interface RealtimeState {
     currentBookmark: Bookmark | null;
     tasks: Task[];
     isLoading: boolean;
     connection: ConnectionState;
     eventQueue: RealtimeEventPayload[];
     lastEventTimestamp: number | null;
   }
   ```

   **New RealtimeState:**
   ```typescript
   interface RealtimeState {
     // New session-based structure
     sessions: Record<string, Session>;
     activeSessionID: string | null;

     // Backward compatibility (keep during transition)
     currentBookmark: Bookmark | null;
     tasks: Task[];
     isLoading: boolean;

     // Enhanced connection management
     connection: ConnectionState;
     eventQueue: RealtimeEventPayload[];
     lastEventTimestamp: number | null;
   }
   ```

   **Migration Steps:**
   - Add sessions Record<sessionID, Session> with bookmark reference tracking
   - Add activeSessionID for tracking current UI focus
   - Keep existing currentBookmark, tasks, isLoading for backward compatibility
   - **CRITICAL**: Modify processEvent reducer to call incrementEventsReceived for ALL session-related events

   **Updated initialState:**
   ```typescript
   const initialState: RealtimeState = {
     // New session-based fields
     sessions: {},
     activeSessionID: null,

     // Existing fields (backward compatibility)
     currentBookmark: null,
     tasks: [],
     isLoading: false,
     connection: {
       status: "disconnected",
       attempts: 0,
       lastConnected: null,
       lastError: null,
       isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
     },
     eventQueue: [],
     lastEventTimestamp: null,
   };
   ```

### Phase 2: Core Event Handlers

**Duration: 2-3 hours**

3. **Implement session management actions**

   - `createSession` - Initialize new AI session with sessionID, refId (bookmark id), empty tasks/usage, eventsReceivedCount: 0
   - `setActiveSession` - Switch between sessions for UI focus
   - `updateSessionUsage` - Update session-level LLM usage (inputTokens, outputTokens, totalTokens, reasoningTokens, cachedInputTokens)
   - `setSessionError` - Handle session-level error states
   - `incrementEventsReceived` - Increment eventsReceivedCount and update lastReceivedEventTimestamp for session

4. **Implement message management actions**

   - `createMessage` - Add new message to session with sessionID, messageID, taskID, and empty parts
   - `setActiveMessage` - Track current streaming message for UI updates

5. **Implement part management actions**

   - `addTextPart` - Add/update TextPart with partID, type, and text content for streaming
   - `addToolPart` - Add new ToolPart with partID, type, toolName, callID, and initial status
   - `updateToolPart` - Update ToolPart status, input, output, metadata, and title
   - `updateTextPart` - Update TextPart text content for streaming updates

6. **Implement event-specific handlers**
   - `handleMessagePartUpdated` - Process message.part.updated events, routing to TextPart or ToolPart handlers
   - `handleMessageUpdated` - Process message.updated events for message-level changes
   - `handleSessionError` - Process session.error events with detailed error context
   - `handleBookmarkUpdated` - Process bookmark.updated events (backward compatibility)
   - `handleTaskStarted` - Process task.started events (backward compatibility)
   - `handleTaskUpdated` - Process task.updated events (backward compatibility)
   - `handleTaskCompleted` - Process task.completed events (backward compatibility)
   - `handleTaskFailed` - Process task.failed events (backward compatibility)

### Phase 3: Event Processing

**Duration: 2-3 hours**

7. **Handle message.part.updated events**

   - Detect part type (TextPart vs ToolPart) and route accordingly
   - For TextPart: Update text content with streaming support for real-time display
   - For ToolPart: Update status, input, output, metadata, title fields
   - Handle ToolPart state transitions (pending → running → completed/error)
   - Support partial updates and incremental content streaming
   - Check if usage is present and update the session accordingly
     - Update session-level LLM usage with all token types
     - Support inputTokens, outputTokens, totalTokens, reasoningTokens, cachedInputTokens
     - Track cumulative usage across session lifetime
     - Support real-time usage monitoring and display
   - **CRITICAL**: Increment session eventsReceivedCount and update lastReceivedEventTimestamp on every event

8. **Handle session.error events**

   - Update session-level error states with detailed context
   - Propagate errors to related messages and parts as needed
   - Maintain error history for debugging and recovery
   - Integrate with existing error notification system
   - **CRITICAL**: Increment session eventsReceivedCount and update lastReceivedEventTimestamp on every event

9. **Handle message.updated events**

   - Process message-level updates separate from part updates
   - Update message metadata, status, or structure changes
   - Integrate with existing message management actions
   - **CRITICAL**: Increment session eventsReceivedCount and update lastReceivedEventTimestamp on every event

10. **Implement event queue processing**
    - Process queued events on reconnection with proper ordering
    - Deduplicate events by sessionID, messageID, partID combinations
    - Handle partial state reconstruction from event history
    - Support all event types: message.part.updated, message.updated, session.error
    - Maintain event sequence integrity and handle out-of-order delivery
    - Enhance existing supabaseMiddleware event routing with new event types
    - Add comprehensive event type validation in processEvent reducer
    - **CRITICAL**: Ensure every processed event increments session eventsReceivedCount and updates lastReceivedEventTimestamp

### Phase 4: Integration & Testing

**Duration: 2-3 hours**

11. **Create selectors and hooks**

    - `useSessionByBookmark` - Get session by bookmark refId with memoization
    - `useSessionMessages` - Get messages for session sorted by timestamp
    - `useMessageParts` - Get parts for message (TextPart/ToolPart) with type safety
    - `useSessionUsage` - Get LLM usage statistics for session with real-time updates
    - `useActiveSession` - Get currently active session with error states
    - `useToolParts` - Get tool parts with status filtering (pending/running/completed/error)
    - `useTextParts` - Get text parts with streaming content support

12. **Integration testing**
    - Test real-time text streaming with TextPart updates
    - Verify ToolPart state transitions (pending → running → completed/error)
    - Test comprehensive ToolPart fields (input, output, metadata, title)
    - Test session-level LLM usage tracking with all token types
    - Test offline/online reconnection with event queue processing
    - Verify backward compatibility with existing bookmark/task events
    - Test multi-session scenarios with bookmark refId tracking
    - Validate error handling and recovery mechanisms

### Phase 5: Migration & Cleanup

**Duration: 1-2 hours**

13. **Gradual migration strategy**

    - Update components to use new session-based selectors
    - Maintain dual support for legacy bookmark/task and new session/message/part patterns
    - Add feature flags for progressive rollout if needed
    - Create migration utilities for existing state data

14. **Remove deprecated functionality**
    - Remove unused `processEventQueue` function from realtimeSlice.ts (no longer needed with new event processing)
    - Remove related `clearEventQueue` if not used elsewhere
    - Clean up any unused imports or action exports related to old event queue processing

15. **Performance optimization**
    - Optimize selector memoization for session, message, and part lookups
    - Add part-level update batching to prevent excessive re-renders
    - Implement message and session pruning for memory management
    - Add efficient indexing for bookmark refId to session mapping
    - Optimize ToolPart status filtering and TextPart streaming performance

## Technical Considerations

### Performance

- Use `Record<ID, Object>` for O(1) lookups
- Implement selective re-rendering with part-level selectors
- Add message/session cleanup for long-running sessions

### Backward Compatibility

- Keep existing bookmark/task state during transition
- Maintain current WebSocket event handlers
- Ensure existing components continue working

### Error Handling

- Graceful degradation for malformed events
- State reconstruction on connection recovery
- Detailed error context for debugging

### Memory Management

- Implement session pruning for inactive sessions
- Add configurable message history limits
- Clean up completed tool calls

## Success Criteria

1. **Real-time streaming works correctly**

   - Text streams update smoothly
   - Tool calls show proper state transitions
   - Usage data displays accurately

2. **Bookmark-linked sessions**

   - Sessions correctly linked to bookmark refIds
   - Multiple sessions per bookmark supported
   - Session usage tracking accurate

3. **Robust error handling**

   - Graceful handling of malformed events
   - Proper error state representation
   - Recovery from connection issues

4. **Performance maintained**

   - No regression in rendering performance
   - Efficient memory usage
   - Smooth user experience

5. **Backward compatibility**
   - Existing bookmark functionality preserved
   - Current components continue working
   - Gradual migration path available

## Future Enhancements

- Message persistence to local storage
- Session export/import functionality
- Advanced message search and filtering
- Message threading and conversation branching
- Enhanced bookmark-session relationship management
- Session history and replay functionality
- Cross-session usage analytics and reporting
