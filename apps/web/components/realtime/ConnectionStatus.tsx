"use client";

import { useAppSelector } from "@/lib/store/hooks";
import { useEffect, useState } from "react";

export const ConnectionStatus = () => {
  const [isClient, setIsClient] = useState(false);
  const connection = useAppSelector((state) => state.realtime.connection);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent hydration mismatch by only rendering on client
  if (!isClient) {
    return null;
  }

  if (connection.status === "connected") {
    return null; // Don't show anything when connected
  }

  const getStatusInfo = () => {
    switch (connection.status) {
      case "reconnecting":
        return {
          color: "bg-yellow-50 border-yellow-200",
          dot: "bg-yellow-500 animate-pulse",
          text: "text-yellow-700",
          message: `Reconnecting... (attempt ${connection.attempts})`,
        };
      case "error":
        return {
          color: "bg-red-50 border-red-200",
          dot: "bg-red-500",
          text: "text-red-700",
          message: `Connection error: ${connection.lastError}`,
        };
      case "disconnected":
        return {
          color: "bg-gray-50 border-gray-200",
          dot: "bg-gray-400",
          text: "text-gray-700",
          message: connection.isOnline
            ? "Disconnected from realtime updates"
            : "You are offline",
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  return (
    <div
      className={`flex items-center gap-2 p-3 ${statusInfo.color} border rounded-md text-sm`}
    >
      <div className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
      <span className={statusInfo.text}>{statusInfo.message}</span>
    </div>
  );
};
