/**
 * The profile page's vocabulary — `/my/profile` and `/u/{handle}` share it.
 *
 * The tab lives in the query string for the same reason Home's scope and
 * Explore's topic do: a tab that survives a refresh can be sent to somebody,
 * and "look at my collections" is a link rather than an instruction.
 */

export const PROFILE_TABS = ["saves", "collections", "likes"] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export const DEFAULT_PROFILE_TAB: ProfileTab = "saves";

export const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
  saves: "Saves",
  collections: "Collections",
  likes: "Likes",
};

export function parseProfileTab(value: string | undefined): ProfileTab {
  return PROFILE_TABS.includes(value as ProfileTab)
    ? (value as ProfileTab)
    : DEFAULT_PROFILE_TAB;
}

/** `base` is `/my/profile` or `/u/{handle}` — one function, both routes. */
export function profileTabHref(base: string, tab: ProfileTab): string {
  return tab === DEFAULT_PROFILE_TAB ? base : `${base}?tab=${tab}`;
}

/**
 * "Joined March 2026".
 *
 * Formatted on the **server**, with an explicit locale and time zone. Left to
 * the browser's defaults this is a classic hydration mismatch: the server
 * renders one month name and a reader in another locale renders a different
 * one, React abandons hydration, and every control on the page goes dead while
 * the page still screenshots perfectly.
 */
export function formatJoinedAt(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `Joined ${date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

/**
 * "You can change your handle again on 12 September 2026."
 *
 * Formatted on the server for the same reason `formatJoinedAt` is, and worded
 * as a whole sentence because the edit dialog shows it in the same slot as the
 * server's own cooldown 409 — one slot, one kind of thing in it.
 *
 * `undefined` means the handle is free to change now.
 */
export function formatHandleAvailableOn(
  value: Date | string | undefined | null
): string | undefined {
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (date.getTime() <= Date.now()) return undefined;

  return `You can change your handle again on ${date.toLocaleDateString(
    "en-US",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
  )}.`;
}

/**
 * Which field a `PATCH /profile` rejection is about.
 *
 * The API answers with a sentence, not a field name, so something has to place
 * it — and the rule is that it goes under the offending field, never in a
 * banner (docs/design-system/pages.md § Auth). Every handle rejection names
 * the handle, which is what makes this readable rather than a guess: the two
 * 409s are `The handle "x" is taken.` and `A handle can be changed once every
 * 30 days…`.
 *
 * `name` is the fallback rather than a banner. Being under the wrong field
 * some of the time beats being under no field every time.
 */
export function profileErrorField(
  message: string
): "name" | "pictureUrl" | "handle" {
  const text = message.toLowerCase();

  if (text.includes("handle")) return "handle";
  if (text.includes("picture") || text.includes("url")) return "pictureUrl";

  return "name";
}

/**
 * Which of the two 409s this is.
 *
 * They share a status code and are told apart by their message, which is the
 * API's own design (packages/apispec/social.tsp: "The handle is taken, or was
 * changed less than 30 days ago"). They are told apart here because the reader
 * can act on one and not the other, and a form that treated them identically
 * would leave a field open for a value it is going to reject again.
 */
export type HandleRejection = "taken" | "cooldown" | "other";

export function handleRejectionKind(message: string): HandleRejection {
  const text = message.toLowerCase();

  if (text.includes("is taken")) return "taken";
  if (text.includes("once every") || text.includes("change yours again")) {
    return "cooldown";
  }

  return "other";
}

/** "12 saves" / "1 save" — a count and its noun, agreeing. */
export function countLabel(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
