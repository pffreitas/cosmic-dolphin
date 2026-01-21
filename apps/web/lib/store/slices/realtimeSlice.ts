import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { Bookmark } from "@cosmic-dolphin/api-client";
import {
  Task,
  SubTask,
  Session,
  Message,
  MessagePart,
  ConnectionState,
  ConnectionStatus,
  RealtimeEventPayload,
  UsagePart,
} from "@/lib/types/realtime";

interface RealtimeState {
  sessions: Record<string, Session>;
  activeSessionID: string | null;

  currentBookmark: Bookmark | null;

  connection: ConnectionState;
}

const initialState: RealtimeState = {
  sessions: {},
  activeSessionID: null,

  currentBookmark: null,
  connection: {
    status: "disconnected",
    attempts: 0,
    lastConnected: null,
    lastError: null,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  },
};

const realtimeSlice = createSlice({
  name: "realtime",
  initialState,
  reducers: {
    // Connection management
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connection.status = action.payload;
      if (action.payload === "connected") {
        state.connection.lastConnected = Date.now();
        state.connection.attempts = 0;
        state.connection.lastError = null;
      }
    },

    incrementConnectionAttempts: (state) => {
      state.connection.attempts += 1;
    },

    setConnectionError: (state, action: PayloadAction<string>) => {
      state.connection.status = "error";
      state.connection.lastError = action.payload;
    },

    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.connection.isOnline = action.payload;
      if (!action.payload) {
        state.connection.status = "disconnected";
      }
    },

    resetConnection: (state) => {
      state.connection.attempts = 0;
      state.connection.lastError = null;
    },

    // Session management
    createSession: (
      state,
      action: PayloadAction<{
        sessionID: string;
        refID: string;
      }>
    ) => {
      const { sessionID, refID } = action.payload;

      if (state.sessions[sessionID]) {
        state.sessions[sessionID].refID = refID;
        return;
      } else {
        state.sessions[sessionID] = {
          sessionID,
          refID,
          tasks: {},
          eventCount: 0,
          lastEventTimestamp: Date.now(),
          usage: {},
          isLoading: true,
        };
      }
      state.activeSessionID = sessionID;
    },

    setActiveSession: (state, action: PayloadAction<string>) => {
      state.activeSessionID = action.payload;
    },

    updateSessionUsage: (
      state,
      action: PayloadAction<{
        sessionID: string;
        usage: UsagePart;
      }>
    ) => {
      const { sessionID, usage } = action.payload;
      const session = state.sessions[sessionID];
      if (session) {
        session.usage.totalTokens =
          (session.usage.totalTokens || 0) + (usage.totalTokens || 0);
        session.usage.inputTokens =
          (session.usage.inputTokens || 0) + (usage.inputTokens || 0);
        session.usage.outputTokens =
          (session.usage.outputTokens || 0) + (usage.outputTokens || 0);
        session.usage.reasoningTokens =
          (session.usage.reasoningTokens || 0) + (usage.reasoningTokens || 0);
        session.usage.cachedInputTokens =
          (session.usage.cachedInputTokens || 0) +
          (usage.cachedInputTokens || 0);
      }
    },

    setSessionError: (
      state,
      action: PayloadAction<{
        sessionID: string;
        error: string;
      }>
    ) => {
      const { sessionID, error } = action.payload;
      const session = state.sessions[sessionID];
      if (session) {
        // Store error in session
        session.error = error;
      }
    },

    setSessionLoading: (
      state,
      action: PayloadAction<{
        sessionID: string;
        isLoading: boolean;
      }>
    ) => {
      const { sessionID, isLoading } = action.payload;
      const session = state.sessions[sessionID];
      if (session) {
        session.isLoading = isLoading;
      }
    },

    // TODO replace calls that increment events received with this
    incrementEventsReceived: (
      state,
      action: PayloadAction<{ sessionID: string }>
    ) => {
      const { sessionID } = action.payload;
      const session = state.sessions[sessionID];
      if (session) {
        session.eventCount += 1;
        session.lastEventTimestamp = Date.now();
        // Keep loading true when events are being received
        session.isLoading = true;
      }
    },

    createMessage: (
      state,
      action: PayloadAction<{
        sessionID: string;
        messageID: string;
        taskID: string;
      }>
    ) => {
      const { sessionID, messageID, taskID } = action.payload;
      const session = state.sessions[sessionID];
      if (session && session.tasks[taskID]) {
        session.tasks[taskID].messages[messageID] = {
          sessionID,
          messageID,
          taskID,
          parts: {},
        };
      }
    },

    // Bookmark management
    setCurrentBookmark: (state, action: PayloadAction<Bookmark>) => {
      state.currentBookmark = action.payload;
    },

    setCurrentBookmarkFromApi: (state, action: PayloadAction<Bookmark>) => {
      state.currentBookmark = action.payload;
    },

    updateBookmark: (state, action: PayloadAction<Bookmark>) => {
      state.currentBookmark = action.payload;
    },

    updateBookmarkFromApi: (state, action: PayloadAction<Bookmark>) => {
      state.currentBookmark = action.payload;
    },

    // Event-specific handlers
    handleMessagePartUpdated: (
      state,
      action: PayloadAction<{
        sessionID: string;
        messageID: string;
        taskID: string;
        partID: string;
        part: MessagePart;
      }>
    ) => {
      const { sessionID, messageID, taskID, partID, part } = action.payload;
      const session = state.sessions[sessionID];
      if (session && session.tasks[taskID]) {
        if (session.tasks[taskID].messages[messageID] === undefined) {
          realtimeSlice.caseReducers.createMessage(state, {
            type: "createMessage",
            payload: {
              sessionID,
              messageID,
              taskID,
            },
          });
        }

        session.tasks[taskID].messages[messageID].parts[partID] = part;
      }
    },

    handleMessageUpdated: (
      state,
      action: PayloadAction<{
        sessionID: string;
        messageID: string;
        taskID: string;
        metadata?: Record<string, any>;
      }>
    ) => {
      const { sessionID, messageID, taskID } = action.payload;
      const session = state.sessions[sessionID];
      if (
        session &&
        session.tasks[taskID] &&
        session.tasks[taskID].messages[messageID]
      ) {
        // Handle message-level updates as needed
      }
    },

    handleSessionError: (
      state,
      action: PayloadAction<{
        sessionID: string;
        error: string;
        context?: Record<string, any>;
      }>
    ) => {
      const { sessionID, error } = action.payload;
      const session = state.sessions[sessionID];
      if (session) {
        session.error = error;
      }
    },

    handleBookmarkUpdated: (state, action: PayloadAction<Bookmark>) => {
      state.currentBookmark = action.payload;
    },

    handleTaskStarted: (
      state,
      action: PayloadAction<{
        sessionID: string;
        taskID: string;
        name: string;
      }>
    ) => {
      const newTask: Task = {
        taskID: action.payload.taskID,
        name: action.payload.name,
        status: "running",
        subTasks: {},
        messages: {},
      };

      //check if session exists
      const session = state.sessions[action.payload.sessionID];
      if (session) {
        session.tasks[action.payload.taskID] = newTask;
      } else {
        realtimeSlice.caseReducers.createSession(state, {
          type: "createSession",
          payload: {
            sessionID: action.payload.sessionID,
            refID: "",
          },
        });
        const createdSession = state.sessions[action.payload.sessionID];
        createdSession.tasks[action.payload.taskID] = newTask;
        createdSession.isLoading = true;
      }
    },

    handleTaskUpdated: (
      state,
      action: PayloadAction<{
        sessionID: string;
        taskID: string;
        name: string;
        status: Task["status"];
        subTasks: Record<string, SubTask>;
      }>
    ) => {
      const session = state.sessions[action.payload.sessionID];
      if (session) {
        session.tasks[action.payload.taskID].status = action.payload.status;
        session.tasks[action.payload.taskID].name = action.payload.name;
        session.tasks[action.payload.taskID].subTasks = action.payload.subTasks;
      }
    },

    handleTaskCompleted: (
      state,
      action: PayloadAction<{
        sessionID: string;
        taskID: string;
        subTasks: Record<string, SubTask>;
      }>
    ) => {
      const session = state.sessions[action.payload.sessionID];
      if (session) {
        session.tasks[action.payload.taskID].status = "completed";
        session.tasks[action.payload.taskID].subTasks = action.payload.subTasks;
      }
    },

    handleTaskFailed: (
      state,
      action: PayloadAction<{
        sessionID: string;
        taskID: string;
        status: Task["status"];
        subTasks: Record<string, SubTask>;
      }>
    ) => {
      const session = state.sessions[action.payload.sessionID];
      if (session) {
        session.tasks[action.payload.taskID].status = action.payload.status;
        session.tasks[action.payload.taskID].subTasks = action.payload.subTasks;
      }
    },

    processEvent: (state, action: PayloadAction<RealtimeEventPayload>) => {
      const event = action.payload;

      if ("sessionID" in event.data) {
        realtimeSlice.caseReducers.incrementEventsReceived(state, {
          type: "incrementEventsReceived",
          payload: {
            sessionID: event.data.sessionID,
          },
        });
      }

      switch (event.type) {
        case "bookmark.updated":
          realtimeSlice.caseReducers.handleBookmarkUpdated(state, {
            type: "handleBookmarkUpdated",
            payload: event.data,
          });
          break;

        case "bookmark.processing.started":
          // Update bookmark with processing status
          realtimeSlice.caseReducers.handleBookmarkUpdated(state, {
            type: "handleBookmarkUpdated",
            payload: event.data.bookmark,
          });
          break;

        case "bookmark.processing.completed":
          // Update bookmark with completed status
          realtimeSlice.caseReducers.handleBookmarkUpdated(state, {
            type: "handleBookmarkUpdated",
            payload: event.data.bookmark,
          });
          break;

        case "bookmark.processing.failed":
          // Update bookmark with failed status
          realtimeSlice.caseReducers.handleBookmarkUpdated(state, {
            type: "handleBookmarkUpdated",
            payload: event.data.bookmark,
          });
          break;

        case "task.started":
          realtimeSlice.caseReducers.handleTaskStarted(state, {
            type: "handleTaskStarted",
            payload: {
              sessionID: event.data.sessionID,
              taskID: event.data.taskID,
              name: event.data.name,
            },
          });
          break;

        case "task.completed":
          realtimeSlice.caseReducers.handleTaskCompleted(state, {
            type: "handleTaskCompleted",
            payload: {
              sessionID: event.data.sessionID,
              taskID: event.data.taskID,
              subTasks: event.data.subTasks,
            },
          });
          break;

        case "task.updated":
          realtimeSlice.caseReducers.handleTaskUpdated(state, {
            type: "handleTaskUpdated",
            payload: {
              sessionID: event.data.sessionID,
              taskID: event.data.taskID,
              name: event.data.name,
              status: event.data.status,
              subTasks: event.data.subTasks,
            },
          });
          break;

        case "task.failed":
          realtimeSlice.caseReducers.handleTaskFailed(state, {
            type: "handleTaskFailed",
            payload: {
              sessionID: event.data.sessionID,
              taskID: event.data.taskID,
              subTasks: event.data.subTasks,
              status: event.data.status,
            },
          });
          break;

        case "session.started":
          const { sessionID, refID } = event.data;
          realtimeSlice.caseReducers.createSession(state, {
            type: "handleSessionStarted",
            payload: {
              sessionID,
              refID,
            },
          });
          break;

        case "session.error":
          realtimeSlice.caseReducers.handleSessionError(state, {
            type: "handleSessionError",
            payload: {
              sessionID: event.data.sessionID,
              error: event.data.error,
              context: event.data.context,
            },
          });
          break;

        case "message.updated":
          realtimeSlice.caseReducers.handleMessageUpdated(state, {
            type: "handleMessageUpdated",
            payload: {
              sessionID: event.data.sessionID,
              messageID: event.data.messageID,
              taskID: event.data.taskID,
              metadata: event.data.metadata,
            },
          });
          break;

        case "message.part.updated":
          realtimeSlice.caseReducers.handleMessagePartUpdated(state, {
            type: "handleMessagePartUpdated",
            payload: {
              sessionID: event.data.sessionID,
              messageID: event.data.messageID,
              taskID: event.data.taskID,
              partID: event.data.partID,
              part: event.data.part,
            },
          });

          realtimeSlice.caseReducers.incrementEventsReceived(state, {
            type: "incrementEventsReceived",
            payload: {
              sessionID: event.data.sessionID,
            },
          });
          break;
      }
    },
  },
});

// Session timeout monitoring thunk
export const checkSessionTimeouts = createAsyncThunk(
  "realtime/checkSessionTimeouts",
  async (_, { getState, dispatch }) => {
    const state = getState() as { realtime: RealtimeState };
    const currentTime = Date.now();
    const timeoutThreshold = 30000; // 30 seconds

    Object.values(state.realtime.sessions).forEach((session) => {
      if (
        session.isLoading &&
        currentTime - session.lastEventTimestamp > timeoutThreshold
      ) {
        dispatch(
          realtimeSlice.actions.setSessionLoading({
            sessionID: session.sessionID,
            isLoading: false,
          })
        );
      }
    });
  }
);

export const {
  // Connection management
  setConnectionStatus,
  incrementConnectionAttempts,
  setConnectionError,
  setOnlineStatus,
  resetConnection,

  // Session management
  createSession,
  setActiveSession,
  updateSessionUsage,
  setSessionError,
  setSessionLoading,
  incrementEventsReceived,

  // Message management
  createMessage,

  // Event-specific handlers
  handleMessagePartUpdated,
  handleMessageUpdated,
  handleSessionError,
  handleBookmarkUpdated,
  handleTaskStarted,
  handleTaskUpdated,
  handleTaskCompleted,
  handleTaskFailed,

  // Backward compatibility
  setCurrentBookmark,
  setCurrentBookmarkFromApi,
  updateBookmark,
  updateBookmarkFromApi,

  // Event queue management
  processEvent,
} = realtimeSlice.actions;

export default realtimeSlice.reducer;
