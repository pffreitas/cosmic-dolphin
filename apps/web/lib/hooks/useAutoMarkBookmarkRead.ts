"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseAutoMarkBookmarkReadOptions {
  enabled: boolean;
  onMarkRead: () => Promise<void>;
}

const READ_DWELL_TIME_MS = 20_000;
const READ_SCROLL_RATIO = 0.7;

export function useAutoMarkBookmarkRead({
  enabled,
  onMarkRead,
}: UseAutoMarkBookmarkReadOptions) {
  const hasMarkedRef = useRef(false);
  const onMarkReadRef = useRef(onMarkRead);

  useEffect(() => {
    onMarkReadRef.current = onMarkRead;
  }, [onMarkRead]);

  useEffect(() => {
    hasMarkedRef.current = false;
  }, [enabled]);

  const markReadOnce = useCallback(async () => {
    if (!enabled || hasMarkedRef.current) return;
    hasMarkedRef.current = true;
    await onMarkReadRef.current();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const timeoutId = window.setTimeout(() => {
      void markReadOnce();
    }, READ_DWELL_TIME_MS);

    const handleScroll = () => {
      const documentElement = document.documentElement;
      const scrollHeight = documentElement.scrollHeight;
      const viewportBottom = window.scrollY + window.innerHeight;
      const hasScrollableContent = scrollHeight > window.innerHeight;

      if (!hasScrollableContent) return;

      const scrollRatio = viewportBottom / scrollHeight;
      if (scrollRatio >= READ_SCROLL_RATIO) {
        void markReadOnce();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [enabled, markReadOnce]);
}
