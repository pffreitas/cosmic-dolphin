import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  Bookmark,
  CreateBookmarkRequest,
  PreviewResponse,
  SearchBookmarksResponse,
} from "@cosmic-dolphin/api-client";
import { SearchBookmarksQuery } from "@/lib/types/bookmark";
import {
  BookmarksClientAPI,
  SaveRateLimitedError,
} from "@/lib/api/bookmarks-client";
import { formatRetryAfter, parseCaptureUrl } from "@/lib/capture";

type SerializableBookmark = Omit<
  Bookmark,
  "processingStartedAt" | "processingCompletedAt"
> & {
  processingStartedAt?: string;
  processingCompletedAt?: string;
};

function serializeDate(value: Date | string | undefined): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function serializeBookmark(bookmark: Bookmark): SerializableBookmark {
  return {
    ...bookmark,
    processingStartedAt: serializeDate(bookmark.processingStartedAt),
    processingCompletedAt: serializeDate(bookmark.processingCompletedAt),
  };
}

/* -------------------------------------------------------------------------
   Optimistic capture.

   A pasted link is a row before the POST is answered — see
   docs/functional-spec/02-capture.md § Optimistic display. The row is built
   from the paste alone: domain, favicon chip, the URL as a provisional title,
   staged progress parked at *Fetching page*.

   The one rule that shapes this state: a failed save is NEVER silently
   removed. It becomes an inline error with Retry, and it stays until the user
   retries it or dismisses it themselves. Anything else loses a save.
   ------------------------------------------------------------------------- */

export type CaptureStatus = "saving" | "saved" | "failed";

export interface PendingCapture {
  /** Client-generated. The row's identity before the server has given it one. */
  id: string;
  /** What the user pasted. Kept verbatim so Retry re-sends exactly it. */
  url: string;
  domain: string;
  faviconUrl?: string;
  /** The URL until `POST /bookmarks/preview` supplies a real one. */
  title: string;
  thumbnailUrl?: string;
  status: CaptureStatus;
  /** One clause, shown inline on the failed row. */
  error?: string;
  /** The saved bookmark's id, once there is one. */
  bookmarkId?: string;
  /**
   * What the server did with it. `idle` means the daily processing budget
   * refused the enqueue — the save stands, and the row offers Summarise now.
   */
  processingStatus?: "idle" | "processing" | "completed" | "failed";
  /** Private-link saves carry the user's own context through a Retry. */
  isPrivateLink?: boolean;
  description?: string;
  providedTitle?: string;
}

export interface CaptureRequest {
  url: string;
  isPrivateLink?: boolean;
  description?: string;
  title?: string;
  /** Present on a Retry: reuse the row already on screen. */
  captureId?: string;
  /**
   * A preview the caller already happens to hold — the private-link dialog
   * fires one while the note is being written. Given one, the thunk uses it
   * instead of asking for a second. Absent is the normal case and costs
   * nothing: the row is drawn from the URL either way.
   */
  preview?: PreviewResponse;
}

export interface CaptureResult {
  captureId: string;
  bookmarkId: string;
  alreadySaved: boolean;
  title?: string;
  processingStatus?: "idle" | "processing" | "completed" | "failed";
}

function newCaptureId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface BookmarksState {
  bookmarks: SerializableBookmark[];
  loading: boolean;
  error: string | null;
  createLoading: boolean;
  createError: string | null;
  /** Set on a 429. The field keeps the URL and shows this. */
  createRateLimit: { message: string; retryIn: string } | null;
  previewLoading: boolean;
  previewError: string | null;
  captures: PendingCapture[];
  searchResults: SerializableBookmark[];
  searchLoading: boolean;
  searchError: string | null;
  searchQuery: string;
}

const initialState: BookmarksState = {
  bookmarks: [],
  loading: false,
  error: null,
  createLoading: false,
  createError: null,
  createRateLimit: null,
  previewLoading: false,
  previewError: null,
  captures: [],
  searchResults: [],
  searchLoading: false,
  searchError: null,
  searchQuery: "",
};

/**
 * Save a link.
 *
 * Three things happen and only one of them is awaited:
 *
 *   1. the optimistic row is pushed into `captures`, synchronously;
 *   2. `POST /bookmarks/preview` is fired and deliberately NOT awaited — it
 *      fills in a real title and image if it happens to land first, and is
 *      irrelevant if it does not;
 *   3. `POST /bookmarks` is awaited, because its answer is the save.
 *
 * A rejection rejects with a message, and the reducer turns the row into an
 * inline error with Retry rather than dropping it.
 */
export const saveCapture = createAsyncThunk<
  CaptureResult,
  CaptureRequest,
  { rejectValue: { captureId: string; error: string; retryIn?: string } }
>("bookmarks/saveCapture", async (request, { dispatch, rejectWithValue }) => {
  const parsed = parseCaptureUrl(request.url);
  const captureId = request.captureId ?? newCaptureId();

  if (!parsed) {
    return rejectWithValue({
      captureId,
      error: "That does not look like a link.",
    });
  }

  dispatch(
    captureStarted({
      id: captureId,
      url: parsed.url,
      domain: parsed.domain,
      faviconUrl: parsed.faviconUrl,
      title: parsed.provisionalTitle,
      status: "saving",
      isPrivateLink: request.isPrivateLink,
      description: request.description,
      providedTitle: request.title,
    })
  );

  // Opportunistic, never awaited. If it lands while the save is still in
  // flight the row gets a real title; if it never lands, nothing is lost.
  if (request.preview) {
    // The caller already has one — no second round trip for the same URL.
    dispatch(
      capturePreviewResolved({ id: captureId, preview: request.preview })
    );
  } else {
    void dispatch(previewUrl(parsed.url))
      .then((result) => {
        if (previewUrl.fulfilled.match(result)) {
          dispatch(
            capturePreviewResolved({
              id: captureId,
              preview: result.payload as PreviewResponse,
            })
          );
        }
      })
      .catch(() => {
        // A preview that fails changes nothing: the row already has a domain,
        // a favicon and a provisional title, and the save is what matters.
      });
  }

  const payload: CreateBookmarkRequest = {
    sourceUrl: parsed.url,
    ...(request.title ? { title: request.title } : {}),
    ...(request.description ? { description: request.description } : {}),
    ...(request.isPrivateLink ? { isPrivateLink: true } : {}),
  };

  try {
    const response = await BookmarksClientAPI.create(payload);
    return {
      captureId,
      bookmarkId: response.bookmark.id,
      alreadySaved: response.alreadySaved === true,
      title: response.bookmark.title ?? undefined,
      processingStatus: response.bookmark.processingStatus,
    };
  } catch (error: any) {
    if (error instanceof SaveRateLimitedError) {
      return rejectWithValue({
        captureId,
        error: error.message,
        retryIn: formatRetryAfter(error.retryAfterSeconds),
      });
    }
    return rejectWithValue({
      captureId,
      error: error?.message || "Could not save that link.",
    });
  }
});

export const previewUrl = createAsyncThunk(
  "bookmarks/preview",
  async (url: string, { rejectWithValue }) => {
    try {
      const response = await BookmarksClientAPI.preview(url);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to preview URL");
    }
  }
);

export const fetchBookmarks = createAsyncThunk(
  "bookmarks/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const bookmarks = await BookmarksClientAPI.list();
      return bookmarks;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch bookmarks");
    }
  }
);

export const searchBookmarks = createAsyncThunk(
  "bookmarks/search",
  async (params: SearchBookmarksQuery, { rejectWithValue }) => {
    try {
      const response = await BookmarksClientAPI.search(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to search bookmarks");
    }
  }
);

const bookmarksSlice = createSlice({
  name: "bookmarks",
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.createRateLimit = null;
      state.previewError = null;
      state.searchError = null;
    },
    captureStarted: (state, action: PayloadAction<PendingCapture>) => {
      const existing = state.captures.findIndex(
        (capture) => capture.id === action.payload.id
      );
      if (existing >= 0) {
        // A Retry: the row on screen goes back to saving rather than a second
        // row appearing beside the first.
        state.captures[existing] = {
          ...state.captures[existing],
          ...action.payload,
          error: undefined,
        };
        return;
      }
      // Newest first: the thing just saved belongs at the top of the list.
      state.captures.unshift(action.payload);
    },
    capturePreviewResolved: (
      state,
      action: PayloadAction<{ id: string; preview: PreviewResponse }>
    ) => {
      const capture = state.captures.find((c) => c.id === action.payload.id);
      // A preview that lands after the save finished is stale — the real
      // bookmark has better metadata than the preview does.
      if (!capture || capture.status !== "saving") return;

      const metadata = action.payload.preview.metadata;
      if (metadata.title) capture.title = metadata.title;
      if (metadata.image) capture.thumbnailUrl = metadata.image;
      if (metadata.favicon) capture.faviconUrl = metadata.favicon;
    },
    /**
     * Removes a capture row. Only ever called from a user gesture — the row
     * dismissing itself is the failure mode this whole slice exists to avoid.
     */
    captureDismissed: (state, action: PayloadAction<string>) => {
      state.captures = state.captures.filter((c) => c.id !== action.payload);
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchQuery = "";
      state.searchError = null;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Save a link (optimistic)
      .addCase(saveCapture.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
        state.createRateLimit = null;
      })
      .addCase(
        saveCapture.fulfilled,
        (state, action: PayloadAction<CaptureResult>) => {
          state.createLoading = false;

          if (action.payload.alreadySaved) {
            // Nothing is processing — the row has been in the library for a
            // while. A pending row would be a lie; the toast is the answer.
            state.captures = state.captures.filter(
              (c) => c.id !== action.payload.captureId
            );
            return;
          }

          const capture = state.captures.find(
            (c) => c.id === action.payload.captureId
          );
          if (capture) {
            capture.status = "saved";
            capture.bookmarkId = action.payload.bookmarkId;
            capture.processingStatus = action.payload.processingStatus;
            capture.error = undefined;
            if (action.payload.title) capture.title = action.payload.title;
          }
        }
      )
      .addCase(saveCapture.rejected, (state, action) => {
        state.createLoading = false;
        const payload = action.payload;
        if (!payload) {
          state.createError = "Could not save that link.";
          return;
        }

        if (payload.retryIn) {
          // A 429 is answered at the field, not on the row: the user still has
          // the URL and the only useful thing to tell them is the wait.
          state.createRateLimit = {
            message: payload.error,
            retryIn: payload.retryIn,
          };
          state.captures = state.captures.filter(
            (c) => c.id !== payload.captureId
          );
          return;
        }

        state.createError = payload.error;
        const capture = state.captures.find((c) => c.id === payload.captureId);
        if (capture) {
          capture.status = "failed";
          capture.error = payload.error;
        }
      })
      // Preview URL
      .addCase(previewUrl.pending, (state) => {
        state.previewLoading = true;
        state.previewError = null;
      })
      .addCase(
        previewUrl.fulfilled,
        (state, _action: PayloadAction<PreviewResponse>) => {
          state.previewLoading = false;
        }
      )
      .addCase(previewUrl.rejected, (state, action) => {
        state.previewLoading = false;
        state.previewError = action.payload as string;
      })
      // Fetch bookmarks
      .addCase(fetchBookmarks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchBookmarks.fulfilled,
        (state, action: PayloadAction<Bookmark[]>) => {
          state.loading = false;
          state.bookmarks = action.payload.map(serializeBookmark);
        }
      )
      .addCase(fetchBookmarks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Search bookmarks
      .addCase(searchBookmarks.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(
        searchBookmarks.fulfilled,
        (state, action: PayloadAction<SearchBookmarksResponse>) => {
          state.searchLoading = false;
          state.searchResults =
            action.payload.bookmarks.map(serializeBookmark);
        }
      )
      .addCase(searchBookmarks.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload as string;
      });
  },
});

export const {
  clearErrors,
  captureStarted,
  capturePreviewResolved,
  captureDismissed,
  clearSearchResults,
  setSearchQuery,
} = bookmarksSlice.actions;
export default bookmarksSlice.reducer;
