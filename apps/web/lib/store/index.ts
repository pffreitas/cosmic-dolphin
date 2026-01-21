import { configureStore } from "@reduxjs/toolkit";
import bookmarksReducer from "./slices/bookmarksSlice";
import realtimeReducer from "./slices/realtimeSlice";
import { createSupabaseMiddleware } from "./middleware/supabaseMiddleware";

export const store = configureStore({
  reducer: {
    bookmarks: bookmarksReducer,
    realtime: realtimeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({}).concat(createSupabaseMiddleware()),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
