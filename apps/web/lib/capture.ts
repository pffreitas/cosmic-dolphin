/**
 * What the capture field needs to know before the server has answered.
 *
 * The authoritative normaliser lives in `packages/shared` and runs inside
 * `POST /bookmarks` — clients never import from `shared`. This is the small
 * client-side half: enough to reject a malformed URL at the field, and enough
 * to draw the optimistic row (a domain, a favicon, a provisional title) from
 * the paste alone.
 */

export interface ParsedCaptureUrl {
  /** The paste, trimmed. This is what gets sent — the server normalises. */
  url: string;
  /** Bare domain for the provenance line: "every.to". */
  domain: string;
  /** A guess, good enough for the chip. A miss falls back to the letter. */
  faviconUrl: string;
  /**
   * The provisional title. The URL with its scheme stripped — recognisable,
   * and honestly provisional, which "Untitled" is not.
   */
  provisionalTitle: string;
}

/**
 * Parse a paste, or say why it cannot be one.
 *
 * Accepts a bare domain (`every.to/p/x`) by assuming https, because that is
 * what a paste from a URL bar or a share sheet often looks like and rejecting
 * it would be pedantry.
 */
export function parseCaptureUrl(input: string): ParsedCaptureUrl | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;

  // Anything with a scheme that is not http(s) — javascript:, data:, mailto: —
  // is rejected outright rather than coerced into an https URL.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate =
    hasScheme || trimmed.startsWith("//") ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // "https://" alone parses. A URL with no host is not a link.
  if (!parsed.hostname || !parsed.hostname.includes(".")) return null;

  const domain = parsed.hostname.replace(/^www\./, "");

  return {
    url: candidate,
    domain,
    faviconUrl: `${parsed.protocol}//${parsed.host}/favicon.ico`,
    provisionalTitle: candidate.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  };
}

/** Cheap validity check for inline field validation. */
export function isCaptureUrl(input: string): boolean {
  return parseCaptureUrl(input) !== null;
}

/**
 * Turn a `Retry-After` into something a person can read.
 *
 * Rounded up, deliberately: telling someone to come back in "0 minutes" and
 * having it fail again is worse than rounding a wait up by fifty seconds.
 */
export function formatRetryAfter(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "a moment";

  if (seconds < 60) return "less than a minute";

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;

  const days = Math.ceil(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}
