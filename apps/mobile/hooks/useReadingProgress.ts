import { useEffect, useRef, useState } from "react";
import { AppState, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView } from "react-native";
import { MobileAPI } from "@/lib/mobile-api";

/** The existing private progress service remains authoritative; never un-read on upward scroll. */
export function useReadingProgress(id: string, userId: string | undefined, enabled: boolean) {
  const scroll = useRef<ScrollView>(null);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");
  const maximum = useRef(0);
  const offset = useRef(0);
  const ready = useRef(false);
  const active = useRef(false);
  const restored = useRef(false);
  const identity = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef<{ id: string; key: string; percent: number; offset: number }>();
  const flush = () => {
    const value = latest.current;
    latest.current = undefined;
    clearTimeout(timer.current); timer.current = undefined;
    if (!value) return;
    void MobileAPI.saveProgress(value.id, value.percent, value.offset).catch(() => {
      if (active.current && identity.current === value.key) setError("Reading progress could not be saved.");
    });
  };
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => {
    let current = true;
    active.current = true; ready.current = false; restored.current = false;
    const key = `${userId ?? ""}:${id}`;
    if (identity.current !== key) { identity.current = key; maximum.current = 0; offset.current = 0; setPercent(0); }
    setError("");
    if (userId && enabled) {
      void MobileAPI.progress(id).then(progress => {
        if (!current) return;
        if ((progress?.percent ?? 0) >= maximum.current) offset.current = progress?.scrollOffset ?? 0;
        maximum.current = Math.max(maximum.current, progress?.percent ?? 0);
        setPercent(maximum.current);
      }).catch(() => {}).finally(() => {
        if (!current) return;
        ready.current = true;
        scroll.current?.scrollTo({ y: offset.current, animated: false });
        restored.current = true;
      });
    }
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") flushRef.current(); });
    return () => { current = false; active.current = false; subscription.remove(); flushRef.current(); };
  }, [id, userId, enabled]);
  const onContentSizeChange = () => {
    if (ready.current && !restored.current) {
      scroll.current?.scrollTo({ y: offset.current, animated: false }); restored.current = true;
    }
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!enabled || !userId || !ready.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const available = contentSize.height - layoutMeasurement.height;
    const measured = available > 0 ? Math.max(0, Math.min(100, contentOffset.y / available * 100)) : 0;
    maximum.current = Math.max(maximum.current, measured); setPercent(maximum.current);
    offset.current = contentOffset.y;
    latest.current = { id, key: identity.current, percent: maximum.current, offset: contentOffset.y };
    if (!timer.current) timer.current = setTimeout(() => flushRef.current(), 5000);
  };
  return { scroll, percent, error, onScroll, onContentSizeChange };
}
