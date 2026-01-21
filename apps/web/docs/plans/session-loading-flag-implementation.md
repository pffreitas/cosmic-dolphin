# Session Loading Flag Implementation Plan

## Overview

Implementation of an `isLoading` flag for Session objects in the realtime slice that automatically manages loading state based on event activity, with a 30-second timeout mechanism to handle inactive sessions.

## Problem Statement

Sessions in the realtime slice currently lack a loading state indicator. We need to:
1. Track when a session is actively processing events (loading state)
2. Automatically detect when a session becomes inactive after 30 seconds without events
3. Provide a clean API for components to check session loading status

## Solution Architecture

### Core Components

#### 1. Session Interface Extension
**File:** `lib/types/realtime.ts`

**Changes Made:**
- Added `isLoading: boolean` field to the `Session` interface (line 32)

#### 2. Loading State Management
**File:** `lib/store/slices/realtimeSlice.ts`

**New Reducer: `setSessionLoading`**
- Manually control session loading state
- Payload: `{ sessionID: string, isLoading: boolean }`
- Updates session loading state if session exists

**Modified Reducer: `createSession`**
- Sets `isLoading: true` when creating new sessions (line 94)
- Ensures loading state is properly initialized

**Modified Reducer: `incrementEventsReceived`**
- Sets `isLoading: true` when events are received (line 168)
- Updates `lastEventTimestamp` to reset timeout counter
- Keeps sessions active while events flow

#### 3. Timeout Monitoring System
**Async Thunk: `checkSessionTimeouts`**
- Monitors all sessions for inactivity
- 30-second timeout threshold (configurable)
- Automatically sets `isLoading: false` for inactive sessions
- Can be called periodically by middleware or components

## Implementation Details

### State Flow

```
Session Creation → isLoading: true
      ↓
Event Received → isLoading: true + timestamp update
      ↓
30s No Events → checkSessionTimeouts() → isLoading: false
```

### Usage Patterns

#### 1. Creating Sessions
```typescript
dispatch(createSession({ sessionID: "abc123", refID: "bookmark-id" }));
// Session starts with isLoading: true
```

#### 2. Monitoring Timeouts
```typescript
// Call periodically (e.g., every 10 seconds)
dispatch(checkSessionTimeouts());
```

#### 3. Manual Loading Control
```typescript
// Manually set loading state
dispatch(setSessionLoading({ sessionID: "abc123", isLoading: false }));
```

#### 4. Reading Loading State
```typescript
const session = useSelector((state) => state.realtime.sessions[sessionID]);
const isSessionLoading = session?.isLoading ?? false;
```

## Technical Considerations

### Performance
- O(1) session lookups via Record<sessionID, Session>
- Timeout checking is O(n) where n = number of sessions
- No automatic timers to prevent memory leaks

### Memory Management
- No persistent timers created
- Timeout checking is manual/triggered
- Sessions maintain their own timestamp state

### Error Handling
- Graceful handling of missing sessions
- Safe property access with optional chaining
- No side effects if session doesn't exist

## Testing Strategy

### Unit Tests
1. **Session Creation**: Verify `isLoading: true` on new sessions
2. **Event Processing**: Confirm loading state maintained during activity
3. **Timeout Logic**: Test 30-second inactivity detection
4. **Manual Control**: Validate `setSessionLoading` functionality

### Integration Tests
1. **Event Flow**: Session loading during real event streams
2. **Timeout Behavior**: Loading state changes after inactivity
3. **Multiple Sessions**: Proper isolation of loading states

## Migration Notes

### Backward Compatibility
- New `isLoading` field is non-breaking (added to interface)
- Existing session functionality unchanged
- No modifications required to existing components initially

### Rollout Strategy
1. **Phase 1**: Deploy loading flag infrastructure ✅
2. **Phase 2**: Integrate timeout monitoring in middleware/components ✅
3. **Phase 3**: Update UI components to show loading states

## Middleware Integration

**File:** `lib/store/middleware/supabaseMiddleware.ts`

**Implementation Details:**
- **Automatic Monitoring**: `checkSessionTimeouts()` called every 10 seconds via `setInterval`
- **Lifecycle Integration**: Started in constructor, cleaned up in `destroy()`
- **Timer Management**: Integrated with existing timer cleanup in `clearTimers()`
- **Performance**: Non-blocking interval monitoring, efficient state updates

**Key Features:**
- ✅ Automatic background monitoring without manual intervention
- ✅ Proper cleanup prevents memory leaks
- ✅ Integrated with existing connection lifecycle
- ✅ Configurable interval (currently 10 seconds for responsive feedback)

**Integration Points:**
```typescript
constructor() {
  // ... existing setup
  this.startSessionTimeoutMonitoring(); // ← Automatic start
}

private startSessionTimeoutMonitoring = () => {
  this.sessionTimeoutTimer = setInterval(() => {
    this.dispatch(checkSessionTimeouts()); // ← Periodic monitoring
  }, this.sessionTimeoutInterval);
};

// Separate timer management for connection vs session monitoring
private clearConnectionTimers = () => {
  this.clearConnectionTimeout();
  this.clearReconnectTimer();
  // Note: NOT clearing session timeout timer
};
```

**Critical Fix Applied:**
- **Issue**: Original `connect()` method called `clearTimers()` which cleared ALL timers including session timeout
- **Solution**: Created `clearConnectionTimers()` method that only clears connection-related timers
- **Result**: Session timeout monitoring persists through connection state changes

## Future Enhancements

### Advanced Loading States
- Granular loading states (connecting, processing, idle)
- Session activity levels and health metrics
- Loading state persistence across reconnections

### UI Integration
- Loading indicators in session-related components
- Progress bars for long-running sessions
- User feedback for inactive sessions

## Success Criteria

✅ **Functional Requirements Met:**
- Sessions start with `isLoading: true`
- Loading state maintained during event activity
- Automatic timeout detection after 30 seconds
- Manual loading state control available

✅ **Non-Functional Requirements:**
- No performance degradation
- Backward compatibility maintained
- Type safety preserved
- Memory-efficient implementation

✅ **Integration Ready:**
- Clean API for component consumption
- Redux DevTools compatible
- Testable architecture
- Documentation provided

## API Reference

### Actions
```typescript
// Auto-exported from realtimeSlice.actions
setSessionLoading(payload: { sessionID: string, isLoading: boolean })

// Async thunk
checkSessionTimeouts() // Returns AsyncThunk
```

### Types
```typescript
interface Session {
  sessionID: string;
  refID: string;
  tasks: Record<string, Task>;
  eventCount: number;
  lastEventTimestamp: number;
  usage: UsagePart;
  error?: string;
  isLoading: boolean; // ← New field
}
```

### Constants
```typescript
const TIMEOUT_THRESHOLD = 30000; // 30 seconds
```