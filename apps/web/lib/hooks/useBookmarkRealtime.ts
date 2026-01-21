"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  processEvent,
  setConnectionStatus,
} from "@/lib/store/slices/realtimeSlice";
import { RealtimeEventPayload } from "@/lib/types/realtime";

interface UseBookmarkRealtimeOptions {
  enabled?: boolean;
}

interface UseBookmarkRealtimeResult {
  isConnected: boolean;
  isProcessing: boolean;
}

/**
 * Hook to subscribe to realtime updates for a specific bookmark.
 * This creates a bookmark-specific channel that receives streaming updates
 * from the worker as it processes the bookmark.
 *
 * @param bookmarkId - The ID of the bookmark to subscribe to
 * @param options - Configuration options
 * @returns Object with connection and processing status
 */
export function useBookmarkRealtime(
  bookmarkId: string,
  options: UseBookmarkRealtimeOptions = {}
): UseBookmarkRealtimeResult {
  const { enabled = true } = options;
  const dispatch = useAppDispatch();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const connectionStatus = useAppSelector(
    (state) => state.realtime.connection.status
  );
  const currentBookmark = useAppSelector(
    (state) => state.realtime.currentBookmark
  );

  // Check if this bookmark is currently processing
  const isProcessing =
    currentBookmark?.id === bookmarkId &&
    (currentBookmark as any)?.processingStatus === "processing";

  const handleRealtimeEvent = useCallback(
    (payload: any) => {
      try {
        const event: RealtimeEventPayload = payload.payload;

        // Verify this event is for our bookmark
        if (payload.payload?.bookmarkId !== bookmarkId) {
          console.warn(
            `Received event for different bookmark: ${payload.payload?.bookmarkId}`
          );
          return;
        }

        console.log(`[Bookmark ${bookmarkId}] Received event:`, event.type);
        dispatch(processEvent(event));
      } catch (error) {
        console.error("Error processing bookmark realtime event:", error);
      }
    },
    [bookmarkId, dispatch]
  );

  useEffect(() => {
    if (!enabled || !bookmarkId) {
      return;
    }

    // Create Supabase client if not exists
    if (!supabaseRef.current) {
      supabaseRef.current = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }

    const channelName = `bookmark:${bookmarkId}`;
    console.log(`[Bookmark ${bookmarkId}] Subscribing to channel:`, channelName);

    // Create and subscribe to the bookmark-specific channel
    const channel = supabaseRef.current.channel(channelName);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "update" }, handleRealtimeEvent)
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          console.log(
            `[Bookmark ${bookmarkId}] Successfully subscribed to channel`
          );
          dispatch(setConnectionStatus("connected"));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            `[Bookmark ${bookmarkId}] Channel error:`,
            error?.message
          );
        } else if (status === "CLOSED") {
          console.log(`[Bookmark ${bookmarkId}] Channel closed`);
        }
      });

    // Cleanup on unmount or when bookmarkId changes
    return () => {
      if (channelRef.current) {
        console.log(
          `[Bookmark ${bookmarkId}] Unsubscribing from channel:`,
          channelName
        );
        supabaseRef.current?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [bookmarkId, enabled, handleRealtimeEvent, dispatch]);

  return {
    isConnected: connectionStatus === "connected",
    isProcessing,
  };
}

export default useBookmarkRealtime;
