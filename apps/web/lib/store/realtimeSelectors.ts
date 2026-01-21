import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "./index";
import { useAppSelector } from "./hooks";
import { Session, Message, MessagePart, ToolPart, TextPart } from "@/lib/types/realtime";

// Base selectors
export const selectRealtimeState = (state: RootState) => state.realtime;
export const selectSessions = (state: RootState) => state.realtime.sessions;
export const selectActiveSessionID = (state: RootState) => state.realtime.activeSessionID;

// Session selectors
export const selectSessionByID = createSelector(
  [selectSessions, (state: RootState, sessionID: string) => sessionID],
  (sessions, sessionID) => sessions[sessionID] || null
);

export const selectSessionByBookmark = createSelector(
  [selectSessions, (state: RootState, refId: string) => refId],
  (sessions, refId) => {
    return Object.values(sessions).find(session => session.refID === refId) || null;
  }
);

export const selectActiveSession = createSelector(
  [selectSessions, selectActiveSessionID],
  (sessions, activeSessionID) => {
    return activeSessionID ? sessions[activeSessionID] || null : null;
  }
);

// Message selectors
export const selectSessionMessages = createSelector(
  [selectSessionByID],
  (session) => {
    if (!session) return {};

    const allMessages: Record<string, Message> = {};
    Object.values(session.tasks).forEach(task => {
      Object.assign(allMessages, task.messages);
    });

    return allMessages;
  }
);

export const selectMessagesByTask = createSelector(
  [selectSessionByID, (state: RootState, sessionID: string, taskID: string) => taskID],
  (session, taskID) => {
    if (!session || !session.tasks[taskID]) return {};
    return session.tasks[taskID].messages;
  }
);

export const selectMessageParts = createSelector(
  [selectSessionMessages, (state: RootState, sessionID: string, messageID: string) => messageID],
  (messages, messageID) => {
    return messages[messageID]?.parts || {};
  }
);

// Part selectors
export const selectTextParts = createSelector(
  [selectMessageParts],
  (parts) => {
    return Object.values(parts).filter((part): part is TextPart => 'type' in part && part.type === "text");
  }
);

export const selectToolParts = createSelector(
  [selectMessageParts],
  (parts) => {
    return Object.values(parts).filter((part): part is ToolPart => 'type' in part && part.type === "tool");
  }
);

export const selectToolPartsByStatus = createSelector(
  [selectToolParts, (state: RootState, sessionID: string, messageID: string, status: ToolPart["status"]) => status],
  (toolParts, status) => {
    return toolParts.filter(part => part.status === status);
  }
);

// Usage selectors
export const selectSessionUsage = createSelector(
  [selectSessionByID],
  (session) => session?.usage || {}
);

// Hooks
export const useSessionByBookmark = (refId: string) => {
  return useAppSelector(state => selectSessionByBookmark(state, refId));
};

export const useSessionMessages = (sessionID: string) => {
  return useAppSelector(state => selectSessionMessages(state, sessionID));
};

export const useMessageParts = (sessionID: string, messageID: string) => {
  return useAppSelector(state => selectMessageParts(state, sessionID, messageID));
};

export const useSessionUsage = (sessionID: string) => {
  return useAppSelector(state => selectSessionUsage(state, sessionID));
};

export const useActiveSession = () => {
  return useAppSelector(selectActiveSession);
};

export const useToolParts = (sessionID: string, messageID: string, status?: ToolPart["status"]) => {
  return useAppSelector(state => {
    const parts = selectMessageParts(state, sessionID, messageID);
    const toolParts = Object.values(parts).filter((part): part is ToolPart => 'type' in part && part.type === "tool");
    return status ? toolParts.filter(part => part.status === status) : toolParts;
  });
};

export const useTextParts = (sessionID: string, messageID: string) => {
  return useAppSelector(state => {
    const parts = selectMessageParts(state, sessionID, messageID);
    return Object.values(parts).filter((part): part is TextPart => 'type' in part && part.type === "text");
  });
};

export const useSessionByID = (sessionID: string) => {
  return useAppSelector(state => selectSessionByID(state, sessionID));
};

export const useMessagesByTask = (sessionID: string, taskID: string) => {
  return useAppSelector(state => selectMessagesByTask(state, sessionID, taskID));
};