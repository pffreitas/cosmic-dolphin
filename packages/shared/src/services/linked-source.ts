import { isIP } from "node:net";
import { normalizeUrl } from "../url";
import type { LinkedSource, LinkedSourceError } from "../types";
import { ContentExtractionError, ExtractedContent } from "./content-extraction";
import { HttpRequestError } from "./http-client";

/** A linked read ends within this budget, whatever the page or its redirects do (NFR-1). */
export const LINKED_READ_BUDGET_MS = 60_000;

/** A destination the follow refuses to contact. Never retried. */
export class RejectedHostError extends Error {
  constructor(public readonly url: string) {
    super("Linked destination is not a public web host");
    this.name = "RejectedHostError";
  }
}

/**
 * §8.7 host rules, by URL syntax: HTTP(S) only, no IP literal, no localhost or
 * its subdomains, no single-label host. DNS and egress protections are backend
 * plan package 3; this guard runs before every dispatch, redirect and retry.
 */
export function assertFollowableUrl(target: URL): void {
  const host = target.hostname.toLowerCase().replace(/\.$/, "");
  const bare = host.replace(/^\[|\]$/g, "");
  if (
    (target.protocol !== "http:" && target.protocol !== "https:") ||
    isIP(bare) !== 0 ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    !host.includes(".")
  ) {
    throw new RejectedHostError(target.href);
  }
}

const EXCLUDED_HOSTS = [
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /^t\.co$/,
  /(^|\.)youtube\.com$/,
  /(^|\.)youtube-nocookie\.com$/,
  /^youtu\.be$/,
];

/**
 * The post's expanded links that could be followed: normalised, deduplicated,
 * without X, t.co, YouTube or PDF destinations. Exactly one means a link-post.
 */
export function eligibleLinks(expanded: string[]): string[] {
  const eligible = new Set<string>();
  for (const raw of expanded) {
    let url: URL;
    try {
      url = new URL(normalizeUrl(raw).url);
    } catch {
      continue;
    }
    // "x.com." is x.com: drop the terminal DNS dot before matching and deduplicating.
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const normalized = normalizeUrl(url.href).url;
    const host = url.hostname;
    if (EXCLUDED_HOSTS.some((pattern) => pattern.test(host))) continue;
    if (/\.pdf$/i.test(url.pathname)) continue;
    eligible.add(normalized);
  }
  return [...eligible];
}

export interface LinkedArticleReadOptions {
  signal: AbortSignal;
  guard: (url: URL) => void;
  /** Request logs would carry the full linked URL; the follow logs once instead. */
  quiet: true;
}

/** Direct HTML extraction with its response and usability checks, no rendering. */
export type LinkedArticleReader = (
  url: string,
  options: LinkedArticleReadOptions,
) => Promise<ExtractedContent>;

export interface LinkedRead {
  linked: LinkedSource;
  article?: ExtractedContent;
}

function failureCode(error: unknown, timedOut: boolean): LinkedSourceError {
  if (timedOut) return "timeout";
  if (error instanceof RejectedHostError) return "rejected_host";
  if (error instanceof ContentExtractionError) return error.code;
  if (error instanceof HttpRequestError) {
    if (error.status === 401) return "auth";
    if (error.status && [400, 404, 410].includes(error.status)) return "unavailable";
    if (error.status) return "blocked";
    if (/timeout/i.test(error.message)) return "timeout";
  }
  return "provider";
}

/**
 * Read the one eligible link within its budget. A failure is an outcome, not an
 * error: the post is still saved. Only the run's own cancellation propagates,
 * so redelivery can fetch again when no row was written.
 */
export async function readLinkedSource(
  url: string,
  reader: LinkedArticleReader,
  runSignal?: AbortSignal,
  budgetMs = LINKED_READ_BUDGET_MS,
): Promise<LinkedRead> {
  runSignal?.throwIfAborted();
  const started = Date.now();
  const budget = new AbortController();
  const timer = setTimeout(() => budget.abort(), budgetMs);
  const signal = runSignal ? AbortSignal.any([runSignal, budget.signal]) : budget.signal;
  const stopped = new Promise<never>((_, reject) =>
    signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
  );
  stopped.catch(() => undefined);
  let host = "";
  let result: LinkedRead | undefined;
  try {
    const target = new URL(url);
    host = target.hostname.toLowerCase();
    assertFollowableUrl(target);
    const article = await Promise.race([
      reader(url, { signal, guard: assertFollowableUrl, quiet: true }),
      stopped,
    ]);
    const title = article.title?.trim();
    result = { linked: { url, status: "complete", ...(title ? { title } : {}) }, article };
  } catch (error) {
    if (runSignal?.aborted) throw error;
    result = { linked: { url, status: "failed", error: failureCode(error, budget.signal.aborted) } };
  } finally {
    clearTimeout(timer);
    const linked = result?.linked;
    // NFR-7: host, status, provider, error class and duration. Never the URL.
    console.info("Linked source", {
      host,
      status: linked?.status ?? "cancelled",
      provider: "direct",
      ...(linked?.status === "failed" ? { error_class: linked.error } : {}),
      duration_ms: Date.now() - started,
    });
  }
  return result;
}
