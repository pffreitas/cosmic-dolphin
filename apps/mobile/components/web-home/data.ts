import type { FeedItem, FeedScope } from "@cosmic-dolphin/api-client";

export const HOME_SCOPES: { value: FeedScope; label: string }[] = [
  { value: "for_you", label: "For you" }, { value: "following", label: "Following" }, { value: "unread", label: "Unread" },
];
export function scopeCopy(scope: FeedScope) {
  return scope === "following" ? "From people you follow, ranked for what you're likely to finish"
    : scope === "unread" ? "Your unread saves, newest first" : "Ranked for what you're likely to finish";
}
export function greeting(date: Date, name?: string) {
  const hour = date.getHours();
  const hello = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.trim().replace(/^@/, "").split(/\s+/)[0];
  return first ? `${hello}, ${first}` : hello;
}
export function domainFor(url?: string) {
  try { return new URL(url!).hostname.replace(/^www\./, ""); } catch { return url ?? ""; }
}
export function relativeTime(date?: Date | string, now = new Date()) {
  if (!date) return undefined;
  const value = new Date(date).getTime();
  if (!Number.isFinite(value)) return undefined;
  const days = Math.floor(Math.max(0, now.getTime() - value) / 86400000);
  if (days >= 365) return `${Math.floor(days / 365)}y ago`;
  if (days >= 7) return `${Math.floor(days / 7)}w ago`;
  if (days > 0) return `${days}d ago`;
  const minutes = Math.floor(Math.max(0, now.getTime() - value) / 60000);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}
export function identitySlot(seed: string) {
  let h = 0x811c9dc5;
  for (const char of seed.trim().toLowerCase().replace(/^www\./, "")) { h ^= char.codePointAt(0) ?? 0; h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 5 + 1;
}
export function splitHome(items: FeedItem[]) {
  const saving: FeedItem[] = [], rest: FeedItem[] = [];
  let lead: FeedItem | undefined;
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.bookmark ? `bookmark:${item.bookmark.id}` : item.digest ? `digest:${item.digest.id}` : undefined;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (item.type === "pending" || item.bookmark?.processingStatus === "processing") saving.push(item);
    else if (!lead && item.bookmark) lead = item;
    else rest.push(item);
  }
  return { saving, lead, rest };
}
export function socialCount(count: number) {
  if (count < 1000) return String(count);
  const n = count < 1000000 ? count / 1000 : count / 1000000;
  return (n >= 100 ? String(Math.round(n)) : n.toFixed(1)).replace(/\.0$/, "") + (count < 1000000 ? "k" : "m");
}

/** Web capture field behavior: a bare domain is a save; other words remain a search. */
export function captureUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//") ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:"].includes(parsed.protocol) && parsed.hostname.includes(".") ? candidate : null;
  } catch { return null; }
}

export function updatedAt(date: Date | string | undefined, now: Date) {
  if (!date) return undefined;
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return undefined;
  const minutes = Math.floor(Math.max(0, now.getTime() - ms) / 60000);
  if (minutes < 1) return "updated just now";
  if (minutes < 60) return `updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "updated yesterday" : `updated ${days} days ago`;
}
