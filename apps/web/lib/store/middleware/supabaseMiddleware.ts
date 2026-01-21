import { Middleware } from "@reduxjs/toolkit";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import {
  setConnectionStatus,
  incrementConnectionAttempts,
  setConnectionError,
  setOnlineStatus,
  resetConnection,
  processEvent,
  checkSessionTimeouts,
} from "../slices/realtimeSlice";
import { RealtimeEventPayload } from "@/lib/types/realtime";
import { RootState } from "../index";

class SupabaseRealtimeManager {
  private channel: RealtimeChannel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private sessionTimeoutTimer: NodeJS.Timeout | null = null;
  private dispatch: any;
  private getState: () => RootState;
  private supabase: ReturnType<typeof createClient>;
  private isDestroyed = false;
  private maxAttempts = 3;
  private sessionTimeoutInterval = 10000; // Check every 10 seconds

  constructor(dispatch: any, getState: () => RootState) {
    this.dispatch = dispatch;
    this.getState = getState;
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Monitor online/offline status
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }

    // Start session timeout monitoring
    this.startSessionTimeoutMonitoring();
  }

  private handleOnline = () => {
    this.dispatch(setOnlineStatus(true));
    if (this.getState().realtime.connection.status === "disconnected") {
      this.connect();
    }
  };

  private handleOffline = () => {
    this.dispatch(setOnlineStatus(false));
    this.disconnect();
  };

  public connect = () => {
    if (this.isDestroyed) return;

    const state = this.getState().realtime.connection;

    // Don't attempt if already connected or if offline
    if (state.status === "connected" || !state.isOnline) return;

    // Check retry limits
    if (state.attempts >= this.maxAttempts) {
      this.dispatch(setConnectionStatus("disconnected"));
      this.dispatch(
        setConnectionError(`Max retries (${this.maxAttempts}) exceeded`)
      );
      return;
    }

    this.dispatch(setConnectionStatus("reconnecting"));
    this.dispatch(incrementConnectionAttempts());

    // Clear existing connection timers (but keep session timeout timer)
    this.clearConnectionTimers();

    try {
      // Create new channel
      this.channel = this.supabase.channel("bookmarks");

      // Set connection timeout (10 seconds)
      this.connectionTimeout = setTimeout(() => {
        this.handleConnectionTimeout();
      }, 10000);

      // Setup event handlers
      this.channel
        .on("broadcast", { event: "update" }, this.handleRealtimeEvent)
        .subscribe((status, error) => {
          this.clearConnectionTimeout();

          if (status === "SUBSCRIBED") {
            this.handleConnectionSuccess();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.handleConnectionError(
              error?.message || `Connection failed: ${status}`
            );
          } else if (status === "CLOSED") {
            this.handleConnectionClosed();
          }
        });
    } catch (error) {
      this.handleConnectionError((error as Error).message);
    }
  };

  private handleConnectionSuccess = () => {
    this.dispatch(setConnectionStatus("connected"));
    this.dispatch(resetConnection());
    console.log("Supabase realtime connection established");
  };

  private handleConnectionError = (error: string) => {
    console.error("Supabase connection error:", error);
    this.dispatch(setConnectionError(error));
    this.scheduleReconnect();
  };

  private handleConnectionTimeout = () => {
    console.warn("Supabase connection timeout");
    this.disconnect();
    this.dispatch(setConnectionError("Connection timeout"));
    this.scheduleReconnect();
  };

  private handleConnectionClosed = () => {
    console.warn("Supabase connection closed");
    this.dispatch(setConnectionStatus("disconnected"));
    this.scheduleReconnect();
  };

  private handleRealtimeEvent = (payload: any) => {
    if (this.isDestroyed) return;

    try {
      const event: RealtimeEventPayload = payload.payload;
      this.dispatch(processEvent(event));
    } catch (error) {
      console.error("Error processing realtime event:", error);
    }
  };

  private scheduleReconnect = () => {
    if (this.isDestroyed || this.reconnectTimer) return;

    const state = this.getState().realtime.connection;
    if (state.attempts >= this.maxAttempts) return;

    // Simple delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, state.attempts), 30000);

    console.log(
      `Scheduling reconnect in ${Math.round(delay)}ms (attempt ${state.attempts + 1})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed && this.getState().realtime.connection.isOnline) {
        this.connect();
      }
    }, delay);
  };

  private clearConnectionTimers = () => {
    this.clearConnectionTimeout();
    this.clearReconnectTimer();
    // Note: NOT clearing session timeout timer
  };

  private clearConnectionTimeout = () => {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  };

  private clearReconnectTimer = () => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  };

  private startSessionTimeoutMonitoring = () => {
    if (this.isDestroyed) return;

    this.sessionTimeoutTimer = setInterval(() => {
      if (!this.isDestroyed) {
        this.dispatch(checkSessionTimeouts());
      }
    }, this.sessionTimeoutInterval);
  };

  private clearSessionTimeoutTimer = () => {
    if (this.sessionTimeoutTimer) {
      clearInterval(this.sessionTimeoutTimer);
      this.sessionTimeoutTimer = null;
    }
  };

  public disconnect = () => {
    this.clearConnectionTimers();

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    if (!this.isDestroyed) {
      this.dispatch(setConnectionStatus("disconnected"));
    }
  };

  public destroy = () => {
    this.isDestroyed = true;
    this.disconnect();
    this.clearSessionTimeoutTimer();

    // Remove event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  };
}

// Singleton instance
let realtimeManager: SupabaseRealtimeManager | null = null;

export const createSupabaseMiddleware = (): Middleware => {
  return (store) => (next) => (action: unknown) => {
    const result = next(action);

    // Initialize connection on first action
    if (!realtimeManager && typeof window !== "undefined") {
      realtimeManager = new SupabaseRealtimeManager(
        store.dispatch,
        store.getState
      );

      // Auto-connect if online
      if (navigator.onLine) {
        realtimeManager.connect();
      }
    }

    // Handle specific actions
    if (typeof action === "object" && action !== null && "type" in action) {
      const typedAction = action as { type: string };
      if (typedAction.type === "realtime/resetConnection") {
        realtimeManager?.connect();
      }
    }

    return result;
  };
};

// Cleanup function for app shutdown
export const destroySupabaseConnection = () => {
  if (realtimeManager) {
    realtimeManager.destroy();
    realtimeManager = null;
  }
};
