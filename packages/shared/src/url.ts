/**
 * URL normalisation — see docs/functional-spec/02-capture.md § Create.
 *
 * `bookmarks(user_id, source_url)` is unique, so dedupe is only as good as the
 * string we key on. Two people sharing the same article hand us
 * `https://Every.to/p/agent-memory/?utm_source=twitter` and
 * `https://every.to/p/agent-memory`; without normalisation those are two rows
 * and the "Already in your library" toast never fires.
 *
 * The rules are deliberately conservative — every one of them is a
 * transformation the origin server itself treats as equivalent:
 *
 *   - lowercase the scheme and the host (case-insensitive per RFC 3986 §6.2.2)
 *   - strip a trailing slash from the path
 *   - drop tracking parameters: `utm_*`, `fbclid`, `gclid`, `ref`, `mc_cid`
 *
 * What it deliberately does NOT do: strip `www.`, reorder or drop other query
 * parameters, or discard the fragment. Those change what the server returns
 * (or, for the fragment, where the page opens), and a dedupe that loses the
 * user's actual destination is worse than a duplicate row.
 *
 * The normalised form goes into `source_url`. What the user actually pasted
 * goes into `metadata.originalUrl` — the paste is evidence, and we never
 * silently rewrite it out of existence.
 */

/** Query parameters dropped wholesale. Matched case-insensitively. */
const TRACKING_PARAMS = new Set(["fbclid", "gclid", "ref", "mc_cid"]);

/** Query parameter prefixes dropped wholesale. Matched case-insensitively. */
const TRACKING_PREFIXES = ["utm_"];

const NORMALISABLE_PROTOCOLS = new Set(["http:", "https:"]);

export interface NormalizedUrl {
  /** The normalised form. Goes into `source_url`. */
  url: string;
  /** Exactly what was handed in, trimmed. Goes into `metadata.originalUrl`. */
  originalUrl: string;
  /** True when normalisation actually changed something. */
  changed: boolean;
}

/** Is this a tracking parameter we drop? */
export function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    TRACKING_PARAMS.has(lower) ||
    TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
}

/**
 * Normalise a pasted URL for storage and dedupe.
 *
 * Anything this cannot parse — an empty string, a bare domain with no scheme,
 * a `mailto:` — comes back trimmed and otherwise untouched. Rejecting bad
 * input is `WebScrapingService.isValidUrl`'s job at the route boundary, not
 * this function's; normalising is not validating, and a normaliser that throws
 * would turn a 400 into a 500.
 */
export function normalizeUrl(input: string): NormalizedUrl {
  const originalUrl = (input ?? "").trim();

  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return { url: originalUrl, originalUrl, changed: false };
  }

  if (!NORMALISABLE_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
    return { url: originalUrl, originalUrl, changed: false };
  }

  // `URL` already lowercases the protocol and the host and drops the default
  // port; naming them here is documentation, not a no-op we can remove.
  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.host.toLowerCase();

  // Credentials are rare and almost always a mistake, but dropping them would
  // change which page the link opens. Preserve them verbatim.
  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";

  // A trailing slash is stripped everywhere, root included: "https://x.com/"
  // and "https://x.com" are the same page and must be the same row.
  const pathname = parsed.pathname.replace(/\/+$/, "");

  // Order is preserved: some servers care, and reordering buys us nothing that
  // dropping the tracking parameters has not already bought.
  //
  // The query is only rebuilt when something was actually dropped.
  // `URLSearchParams.toString()` re-encodes as it serialises, and re-encoding
  // a query we had no reason to touch would rewrite links for no gain.
  const params = new URLSearchParams(parsed.search);
  const dropped = Array.from(params.keys()).filter(isTrackingParam);
  let search = parsed.search;
  if (dropped.length > 0) {
    for (const name of dropped) {
      params.delete(name);
    }
    const query = params.toString();
    search = query ? `?${query}` : "";
  }

  const url = `${protocol}//${credentials}${host}${pathname}${search}${parsed.hash}`;

  return { url, originalUrl, changed: url !== originalUrl };
}
