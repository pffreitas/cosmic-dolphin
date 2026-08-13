"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { cn } from "@/lib/utils";

interface BookmarkReadToggleButtonProps {
  bookmarkId: string;
  initialIsRead?: boolean;
  compact?: boolean;
  className?: string;
}

export function BookmarkReadToggleButton({
  bookmarkId,
  initialIsRead = false,
  compact = false,
  className,
}: BookmarkReadToggleButtonProps) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(initialIsRead);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (isLoading) return;

    const previousIsRead = isRead;
    setIsRead(!isRead);
    setIsLoading(true);

    try {
      const updated = isRead
        ? await BookmarksClientAPI.markUnread(bookmarkId)
        : await BookmarksClientAPI.markRead(bookmarkId);
      setIsRead(updated.isRead ?? !previousIsRead);
      router.refresh();
    } catch (error) {
      console.error("Failed to update read state:", error);
      setIsRead(previousIsRead);
    } finally {
      setIsLoading(false);
    }
  };

  const icon = isLoading ? (
    <Loader2Icon className="size-3.5 animate-spin" />
  ) : isRead ? (
    <RotateCcwIcon className="size-3.5" />
  ) : (
    <CheckIcon className="size-3.5" />
  );

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "sm" : "default"}
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {icon}
      <span>{isRead ? "Mark unread" : "Mark read"}</span>
    </Button>
  );
}
