import {
  Bookmark,
  FeedActor,
  FeedItem,
  FeedItemType,
  FeedScope,
  RankingSignal,
} from "../types";
import { Bookmark as BookmarkRow, FeedImpressionItemType } from "../database/schema";
import {
  FeedRepository,
  FinishedReadRow,
  RecentlyServedRow,
  SaveOutcomeRow,
  impressionKey,
} from "../repositories/feed.repository";
import { PublicProfileRow } from "../repositories/social.repository";
import { SocialService } from "./social.service";
import { mapDatabaseRowToBookmark } from "./bookmark.service";
import {
  DEFAULT_FEED_RANKING_CONFIG,
  FEED_SIGNAL_NAMES,
  FeedRankingConfig,
  FeedSignalName,
  mergeFeedRankingConfig,
} from "./feed-ranking.config";

/**
 * The Home feed's ranker — docs/functional-spec/05-feed.md.
 *
 * Three promises are made here and nowhere else, so it is worth naming where
 * each of them actually lives:
 *
 *  - **It explains itself in one sentence per item.** `buildRankingReason`
 *    writes that sentence from the top two *contributions*, which are the
 *    weighted values the score was actually built from. There is no template
 *    the client could reproduce, because the client does not know what the
 *    ranker weighted — and a plausible-sounding wrong answer is worse than
 *    none.
 *  - **The same item is not served indefinitely unopened.** `feed_impressions`
 *    counts serves; three unopened serves multiply the score by 0.6 and five
 *    remove the item from For you entirely. It stays in Unread, which does not
 *    rank, so nothing is *lost* — it stops being pushed.
 *  - **No signal rewards engagement time or popularity alone.** There is no
 *    engagement-time signal at all. `social_proof` counts only people the
 *    viewer follows, is log-scaled, and saturates at `socialProofCap`; at its
 *    configured weight the most-shared item in the world gains 0.15, which
 *    cannot outrank the other five signals combined.
 *
 * Everything below the candidate query is pure, synchronous, and takes its
 * clock as an argument. That is what makes the three promises testable without
 * a database.
 */

// ---------------------------------------------------------------------------
// What the service takes and gives back
// ---------------------------------------------------------------------------

/** Where a page resumes. The API layer owns the opaque encoding. */
export interface FeedCursor {
  scope: FeedScope;
  /**
   * The ranking session this cursor was produced under, not a position in a
   * list of rows. A session is a materialised ordering; paging inside one is
   * stable even though the next recomputation will order things differently.
   */
  session: string;
  /** Index into that session's ordering. */
  position: number;
}

/**
 * What the ranking cost, for the record.
 *
 * The plan's open decision on the interest vector says to measure before
 * materialising it on a nightly job. This is the measurement: the route logs
 * it on every miss, so the question is answered by production rather than by
 * argument.
 */
export interface FeedRankingMetrics {
  cacheHit: boolean;
  candidateCount: number;
  /** Milliseconds inside `similarityToInterestVector` — the cost in question. */
  interestVectorMs: number;
  /** Milliseconds for the whole ranking, candidate query included. */
  totalMs: number;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: FeedCursor | null;
  computedAt: Date;
  metrics: FeedRankingMetrics;
}

export interface GetFeedOptions {
  scope?: FeedScope;
  limit?: number;
  cursor?: FeedCursor | null;
  /** Injected in tests. Production passes nothing and gets the wall clock. */
  now?: Date;
}

export interface FeedRankingService {
  getFeed(userId: string, options?: GetFeedOptions): Promise<FeedPage>;

  /**
   * "They went in." Called when a bookmark is marked read, which is the only
   * event in the product that means the user actually opened the thing.
   * Failure is swallowed: an impression that did not record must never turn a
   * successful read into a 500.
   */
  recordOpen(userId: string, bookmarkId: string): Promise<void>;

  /** Drop this user's cached ranking. Used by the tests, and by nothing else. */
  invalidate(userId: string): void;
}

// ---------------------------------------------------------------------------
// The scored candidate, before it becomes a feed item
// ---------------------------------------------------------------------------

interface Candidate {
  type: FeedItemType;
  bookmark: BookmarkRow;
  actor: PublicProfileRow | null;
  /** Own unread from the last 90 days, or a followed public save. */
  createdAt: Date;
  domain: string;
  tags: string[];
}

interface ScoredCandidate {
  candidate: Candidate;
  score: number;
  signals: RankingSignal[];
  reason: string;
  /** Unopened serve count, carried so the drop pass does not re-read it. */
  unopenedServes: number;
}

/** One entry of a materialised ranking session. */
interface SessionEntry {
  item: FeedItem;
  itemType: FeedImpressionItemType;
  itemId: string;
}

interface RankedSession {
  token: string;
  computedAt: Date;
  entries: SessionEntry[];
  /** After this, page one recomputes. Five minutes, per the spec. */
  headExpiresAt: number;
  /** After this, a cursor into this session can no longer be honoured. */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// The signals, each on its own, each pure
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Exponential decay with the configured half-life. 1.0 at the moment of
 * saving, 0.5 a half-life later, and it never reaches zero — an old save is
 * quiet, not disqualified.
 */
export function recencyScore(
  createdAt: Date,
  now: Date,
  halfLifeDays: number
): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / DAY_MS);
  if (halfLifeDays <= 0) return 0;
  return Math.pow(2, -ageDays / halfLifeDays);
}

/**
 * Log-scaled and hard-capped.
 *
 * This is the whole of "capped so no item can win on popularity alone",
 * written as a function so the property can be asserted rather than asserted
 * about. Above `cap` it is flat: the ten-thousandth person you follow saving
 * something moves the score by exactly zero.
 */
export function socialProofScore(count: number, cap: number): number {
  if (count <= 0 || cap <= 0) return 0;
  return Math.min(1, Math.log1p(count) / Math.log1p(cap));
}

/**
 * How well a length matches what this reader actually finishes at this hour.
 *
 * Neutral — 0.5, not 0 — when either number is missing. An article with no
 * `readingTime` has not failed the test, it has not taken it, and scoring it
 * zero would quietly bury everything the pipeline could not measure.
 */
export function effortFitScore(
  readingTime: number | null,
  typical: number | null
): number {
  if (readingTime === null || typical === null) return 0.5;
  if (readingTime <= 0 || typical <= 0) return 0.5;
  const ratio = Math.abs(readingTime - typical) / typical;
  return Math.max(0, 1 - Math.min(1, ratio));
}

/**
 * The one signal that is a penalty: 1.0 for something unlike the last twenty
 * items served, falling towards 0 as the domain or the topic starts to
 * dominate.
 */
export function noveltyScore(
  domain: string,
  tags: string[],
  recent: { domain: string; tags: string[] }[]
): number {
  if (recent.length === 0) return 1;

  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));

  let dominant = 0;
  for (const entry of recent) {
    if (entry.domain && entry.domain === domain) {
      dominant += 1;
      continue;
    }
    if (entry.tags.some((tag) => tagSet.has(tag.toLowerCase()))) {
      dominant += 1;
    }
  }

  return 1 - Math.min(1, dominant / recent.length);
}

/**
 * The user's finish rate for a domain, with a Laplace prior.
 *
 * `(finished + 1) / (saved + 2)` starts an unseen domain at exactly 0.5 and
 * moves it only as evidence arrives. Without the prior, the first save from a
 * new domain would score 0 and the domain would never get a second chance to
 * be read — a ranker that cannot discover anything.
 *
 * Note what it measures: **open and finish**, not clicks. A domain the user
 * saves ten times and finishes once scores 0.17, below a domain they have
 * never saved from.
 */
export function sourceAffinityScore(finished: number, saved: number): number {
  return (finished + 1) / (saved + 2);
}

/**
 * The seen-decay multiplier. 1.0 until the item has been served
 * `seenDecayAfter` times without being opened, then `seenDecayFactor`.
 *
 * Applied to the score rather than after the ordering, because a multiplier
 * applied after the list is ordered does nothing at all. The *drop* half of
 * seen decay is a post-processing pass — see `applySeenDrop`.
 */
export function seenDecayMultiplier(
  unopenedServes: number,
  after: number,
  factor: number
): number {
  return unopenedServes >= after ? factor : 1;
}

// ---------------------------------------------------------------------------
// Post-processing, in the order the spec gives
// ---------------------------------------------------------------------------

/** What the diversity pass keys on: the person, or failing that the domain. */
export interface DiversityKeyed {
  authorId: string;
  domain: string;
}

/**
 * At most `max` consecutive items from one person or one domain.
 *
 * Nothing is dropped — a run of five saves from the same author is not five
 * bad items, it is a bad *order*. The pass walks the list and defers the
 * offending item to the next slot where it does not extend a run, which keeps
 * the ranking's judgement and only spaces its output.
 */
export function applyAuthorDiversity<T extends DiversityKeyed>(
  items: T[],
  max: number
): T[] {
  if (max < 1 || items.length <= max) return items;

  const remaining = [...items];
  const result: T[] = [];

  while (remaining.length > 0) {
    let chosenIndex = 0;

    for (let i = 0; i < remaining.length; i += 1) {
      if (!extendsRun(result, remaining[i], max)) {
        chosenIndex = i;
        break;
      }
    }

    // Every remaining item would extend a run — which happens when they all
    // come from one author. Take the best one anyway: spacing is a
    // preference, and an empty tail is not an improvement on a repetitive one.
    result.push(remaining[chosenIndex]);
    remaining.splice(chosenIndex, 1);
  }

  return result;
}

function extendsRun<T extends DiversityKeyed>(
  placed: T[],
  candidate: T,
  max: number
): boolean {
  if (placed.length < max) return false;

  const tail = placed.slice(-max);

  const sameAuthor =
    candidate.authorId !== "" &&
    tail.every((item) => item.authorId === candidate.authorId);
  const sameDomain =
    candidate.domain !== "" &&
    tail.every((item) => item.domain === candidate.domain);

  return sameAuthor || sameDomain;
}

/**
 * At most one digest per `spacing` items, and at most `maxPerSession` in the
 * whole session. Surplus digests are removed, not deferred: a digest is a
 * summary of a moment, and a moment held back to the fourth screen is stale.
 *
 * The pass runs over an empty digest set today — digests are their own
 * deliverable. It is here because the ordering it belongs to is this one, and
 * bolting spacing on afterwards is how "two digests in one screenful" happens.
 */
export function applyDigestSpacing<T extends { type: FeedItemType }>(
  items: T[],
  spacing: number,
  maxPerSession: number
): T[] {
  const result: T[] = [];
  let digests = 0;
  let sinceLastDigest = Number.MAX_SAFE_INTEGER;

  for (const item of items) {
    if (item.type !== "digest") {
      result.push(item);
      sinceLastDigest += 1;
      continue;
    }

    if (digests >= maxPerSession || sinceLastDigest < spacing) continue;

    result.push(item);
    digests += 1;
    sinceLastDigest = 0;
  }

  return result;
}

/**
 * The half of seen decay that removes rather than dampens: an item served
 * `dropAfter` times without being opened leaves For you.
 *
 * It leaves **For you** — not the product. The Unread scope does not rank and
 * does not run this pass, so the item is still there, in the order the user
 * saved it. "Stop pushing this at me" and "hide this from me" are different
 * promises and only the first one is the ranker's to make.
 */
export function applySeenDrop<T extends { unopenedServes: number }>(
  items: T[],
  scope: FeedScope,
  dropAfter: number
): T[] {
  if (scope === "unread") return items;
  return items.filter((item) => item.unopenedServes < dropAfter);
}

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

export interface ReasonContext {
  isOwn: boolean;
  actorName: string | null;
  domain: string;
  ageLabel: string;
  socialCount: number;
  topTag: string | null;
}

/**
 * The clause each signal contributes, in second person, lower-case, and with
 * no full stop — they are assembled into one sentence below.
 *
 * Every clause states the *evidence*, not the conclusion. "You finish most of
 * what you save from every.to" is a fact about the reader that they can check;
 * "this is highly relevant to you" is the ranker admiring itself.
 */
const REASON_CLAUSES: Record<
  FeedSignalName,
  (context: ReasonContext) => string
> = {
  topic_affinity: (context) =>
    context.topTag
      ? `it lines up with the ${context.topTag} links you've been finishing`
      : "it's close to what you've been reading lately",
  source_affinity: (context) =>
    context.domain
      ? `you finish most of what you save from ${context.domain}`
      : "you finish most of what you save from this source",
  recency: (context) =>
    context.isOwn
      ? `you saved it ${context.ageLabel}`
      : context.actorName
        ? `${context.actorName} shared it ${context.ageLabel}`
        : `it was shared ${context.ageLabel}`,
  social_proof: (context) =>
    context.socialCount === 1
      ? "one person you follow saved it"
      : `${context.socialCount} people you follow saved it`,
  effort_fit: () => "it's about the length you usually finish",
  novelty: () => "it's a change from what's been filling your feed",
};

/**
 * One sentence, from the two signals that actually moved this item.
 *
 * Ties are broken by the configured weight order, so the sentence is stable
 * between two requests that scored the same — a reason that changes wording
 * on a refresh reads as a machine guessing.
 */
export function buildRankingReason(
  signals: RankingSignal[],
  context: ReasonContext
): string {
  const ranked = [...signals]
    .filter((signal) => signal.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);

  if (ranked.length === 0) {
    return context.isOwn
      ? `You saved this ${context.ageLabel} and haven't opened it yet.`
      : `Someone you follow shared this ${context.ageLabel}.`;
  }

  const clauses = ranked.map((signal) =>
    REASON_CLAUSES[signal.name as FeedSignalName](context)
  );

  const sentence =
    clauses.length === 1 ? clauses[0] : `${clauses[0]}, and ${clauses[1]}`;

  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/** "just now", "yesterday", "3 days ago" — the age a sentence can carry. */
export function ageLabel(createdAt: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - createdAt.getTime());
  const days = Math.floor(ms / DAY_MS);

  if (days === 0) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours < 1) return "just now";
    return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
}

/** The host, without `www.`. Empty string for anything unparseable. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Four buckets. Enough to tell a commute from a Sunday afternoon. */
export function timeOfDayBucket(date: Date): number {
  const hour = date.getHours();
  if (hour < 6) return 0;
  if (hour < 12) return 1;
  if (hour < 18) return 2;
  return 3;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * The length this reader typically finishes at this hour, falling back to the
 * length they typically finish at any hour. Null when they have finished
 * nothing measurable, which `effortFitScore` reads as "no opinion".
 */
export function typicalLength(
  finished: FinishedReadRow[],
  bucket: number
): number | null {
  const measured = finished.filter(
    (row): row is FinishedReadRow & { readingTime: number } =>
      row.readingTime !== null && row.readingTime > 0
  );

  const inBucket = measured
    .filter((row) => timeOfDayBucket(row.readAt) === bucket)
    .map((row) => row.readingTime);

  return median(inBucket) ?? median(measured.map((row) => row.readingTime));
}

/** Finish rate per domain, from the saves the user has made. */
export function domainOutcomes(
  outcomes: SaveOutcomeRow[]
): Map<string, { saved: number; finished: number }> {
  const map = new Map<string, { saved: number; finished: number }>();

  for (const outcome of outcomes) {
    const domain = domainOf(outcome.sourceUrl);
    if (!domain) continue;
    const entry = map.get(domain) ?? { saved: 0, finished: 0 };
    entry.saved += 1;
    if (outcome.read) entry.finished += 1;
    map.set(domain, entry);
  }

  return map;
}

/**
 * The tags the reader has been finishing, most-finished first. The fallback
 * for topic affinity when there is no interest vector — a new account whose
 * saves have not been embedded yet still gets a ranked feed rather than six
 * signals of which the heaviest is silent.
 */
export function finishedTagWeights(
  bookmarks: { cosmicTags: string[] | null }[]
): Map<string, number> {
  const weights = new Map<string, number>();

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.cosmicTags ?? []) {
      const key = tag.toLowerCase();
      weights.set(key, (weights.get(key) ?? 0) + 1);
    }
  }

  return weights;
}

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

export class FeedRankingServiceImpl implements FeedRankingService {
  /**
   * Ranking sessions, keyed `${userId}:${scope}:${token}`, plus a pointer to
   * the current token per (user, scope).
   *
   * In-process on purpose, and worth being honest about: with more than one
   * API container a user can land on a cold one and get a fresh ranking. That
   * is a recomputation, not an error — the cursor carries its session and a
   * session that is not here is recomputed with the last quarter-hour of
   * served items excluded, so the page after a container hop does not repeat
   * itself. If the recomputation rate ever matters, this map is the thing to
   * move to Redis, and nothing above it changes.
   */
  private sessions = new Map<string, RankedSession>();
  private currentToken = new Map<string, string>();

  constructor(
    private feedRepository: FeedRepository,
    private socialService: SocialService,
    private environment: string
  ) {}

  async getFeed(userId: string, options: GetFeedOptions = {}): Promise<FeedPage> {
    const now = options.now ?? new Date();
    const scope = options.scope ?? "for_you";
    const config = await this.loadConfig();
    const limit = clamp(
      options.limit ?? config.parameters.pageSize,
      1,
      config.parameters.maxPageSize
    );

    const cursor = options.cursor ?? null;

    if (cursor) {
      const session = this.sessionFor(userId, scope, cursor.session, now);
      if (session) {
        return this.pageFrom(userId, session, cursor.position, limit, scope, {
          cacheHit: true,
          candidateCount: session.entries.length,
          interestVectorMs: 0,
          totalMs: 0,
        });
      }

      // The session is gone — an expiry, a redeploy, a different container.
      // Recompute, and exclude what was served while it was alive, so the
      // reader gets the next thing rather than the first thing again.
      const excludeSince = new Date(
        now.getTime() - config.parameters.sessionTtlSeconds * 1000
      );
      const served = await this.feedRepository.findServedSince(
        userId,
        excludeSince
      );
      const rebuilt = await this.buildSession(userId, scope, config, now, {
        exclude: new Set(served),
      });
      return this.pageFrom(userId, rebuilt.session, 0, limit, scope, rebuilt.metrics);
    }

    const current = this.currentSession(userId, scope, now);
    if (current && now.getTime() < current.headExpiresAt) {
      // The head is warm. A save made since it was computed still has to reach
      // the top of the page — the user just made it and expects to see it —
      // so the cache is *prepended to*, not served past.
      await this.prependFreshSaves(userId, scope, current, config, now);
      return this.pageFrom(userId, current, 0, limit, scope, {
        cacheHit: true,
        candidateCount: current.entries.length,
        interestVectorMs: 0,
        totalMs: 0,
      });
    }

    const built = await this.buildSession(userId, scope, config, now, {});
    return this.pageFrom(userId, built.session, 0, limit, scope, built.metrics);
  }

  async recordOpen(userId: string, bookmarkId: string): Promise<void> {
    try {
      await this.feedRepository.markOpened(userId, "bookmark", bookmarkId);
    } catch {
      // An impression that did not record is a slightly worse ranking. A read
      // that returned 500 is a broken product.
    }
  }

  invalidate(userId: string): void {
    for (const key of [...this.sessions.keys()]) {
      if (key.startsWith(`${userId}:`)) this.sessions.delete(key);
    }
    for (const key of [...this.currentToken.keys()]) {
      if (key.startsWith(`${userId}:`)) this.currentToken.delete(key);
    }
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  private async loadConfig(): Promise<FeedRankingConfig> {
    // Read at request time, as the plan's open decision settles. It is one
    // indexed single-row lookup; caching it would be the difference between
    // "tunable without a deploy" and "tunable without a deploy, eventually".
    try {
      const overrides = await this.feedRepository.findRankingConfig(
        this.environment
      );
      return mergeFeedRankingConfig(overrides);
    } catch {
      return DEFAULT_FEED_RANKING_CONFIG;
    }
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  private sessionKey(userId: string, scope: FeedScope, token: string): string {
    return `${userId}:${scope}:${token}`;
  }

  private sessionFor(
    userId: string,
    scope: FeedScope,
    token: string,
    now: Date
  ): RankedSession | null {
    const key = this.sessionKey(userId, scope, token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (now.getTime() >= session.expiresAt) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  private currentSession(
    userId: string,
    scope: FeedScope,
    now: Date
  ): RankedSession | null {
    const token = this.currentToken.get(`${userId}:${scope}`);
    if (!token) return null;
    return this.sessionFor(userId, scope, token, now);
  }

  private store(
    userId: string,
    scope: FeedScope,
    session: RankedSession,
    now: Date
  ): void {
    this.sessions.set(this.sessionKey(userId, scope, session.token), session);
    this.currentToken.set(`${userId}:${scope}`, session.token);
    this.evictExpired(now);
  }

  /**
   * Takes the clock as an argument, like everything else here.
   *
   * It matters more than it looks: a sweep that read the wall clock while the
   * rest of the service ran on an injected one would evict the session it had
   * just stored, and every request would be a cache miss that still reported
   * itself as a cache.
   */
  private evictExpired(now: Date): void {
    for (const [key, session] of this.sessions) {
      if (now.getTime() >= session.expiresAt) this.sessions.delete(key);
    }
  }

  /**
   * Bookmarks saved after the cached ranking was computed, pushed to the front
   * of it.
   *
   * Two cheap indexed queries against the head of the user's own library —
   * far less than a recomputation, which is the whole point of the cache. The
   * new rows are pinned above the ranking rather than scored into it: they are
   * new, the user made them, and nothing about a fresh save needs a ranker's
   * opinion.
   */
  private async prependFreshSaves(
    userId: string,
    scope: FeedScope,
    session: RankedSession,
    config: FeedRankingConfig,
    now: Date
  ): Promise<number> {
    if (scope === "following") return 0;

    const [pending, fresh] = await Promise.all([
      this.feedRepository.findPending(userId, config.parameters.pageSize),
      this.feedRepository.findOwnUnread(
        userId,
        session.computedAt,
        config.parameters.pageSize
      ),
    ]);

    const known = new Set(session.entries.map((entry) => entry.itemId));
    const additions: SessionEntry[] = [];

    for (const row of [...pending, ...fresh]) {
      if (known.has(row.id)) continue;
      known.add(row.id);
      additions.push(
        this.toSessionEntry(
          row.processing_status === "processing" ? "pending" : "own_save",
          row,
          null,
          row.processing_status === "processing"
            ? undefined
            : `You saved this ${ageLabel(row.created_at, now)} and haven't opened it yet.`
        )
      );
    }

    if (additions.length > 0) {
      session.entries = [...additions, ...session.entries];
    }

    return additions.length;
  }

  // -------------------------------------------------------------------------
  // The ranking itself
  // -------------------------------------------------------------------------

  private async buildSession(
    userId: string,
    scope: FeedScope,
    config: FeedRankingConfig,
    now: Date,
    options: { exclude?: Set<string> }
  ): Promise<{ session: RankedSession; metrics: FeedRankingMetrics }> {
    const startedAt = Date.now();
    const { parameters } = config;
    const exclude = options.exclude ?? new Set<string>();

    const ownSince = new Date(
      now.getTime() - parameters.ownUnreadWindowDays * DAY_MS
    );
    const followedSince = new Date(
      now.getTime() - parameters.followedWindowDays * DAY_MS
    );

    const wantsOwn = scope !== "following";
    const wantsFollowed = scope !== "unread";

    const [pendingRows, ownRows, followedRows] = await Promise.all([
      wantsOwn
        ? this.feedRepository.findPending(userId, parameters.pageSize)
        : Promise.resolve([]),
      wantsOwn
        ? this.feedRepository.findOwnUnread(
            userId,
            // Unread does not rank, and it is where a decayed item stays
            // reachable — so it is not bounded by the ranking window.
            scope === "unread" ? new Date(0) : ownSince,
            parameters.candidateCap
          )
        : Promise.resolve([]),
      wantsFollowed
        ? this.feedRepository.findFollowedSaves(
            userId,
            followedSince,
            parameters.candidateCap
          )
        : Promise.resolve([]),
    ]);

    // Block filtering, once per distinct author rather than once per item.
    // Blocking already drops both follow edges, so this normally removes
    // nothing — it is here because "cannot happen" and "was checked" are
    // different things, and the second one is the one a feed owes people.
    const authorIds = [
      ...new Set(followedRows.map((row) => row.author.id)),
    ].filter((id) => id !== userId);

    const interactable = new Set<string>();
    await Promise.all(
      authorIds.map(async (id) => {
        if (await this.socialService.canInteract(userId, id)) {
          interactable.add(id);
        }
      })
    );

    const pending: Candidate[] = pendingRows
      .filter((row) => !exclude.has(row.id))
      .map((row) => toCandidate("pending", row, null));

    const pendingIds = new Set(pending.map((item) => item.bookmark.id));

    const ranked: Candidate[] = [
      ...ownRows
        .filter((row) => !exclude.has(row.id) && !pendingIds.has(row.id))
        .map((row) => toCandidate("own_save", row, null)),
      ...followedRows
        .filter(
          (row) =>
            interactable.has(row.author.id) &&
            !exclude.has(row.bookmark.id) &&
            !pendingIds.has(row.bookmark.id)
        )
        .map((row) =>
          toCandidate(
            row.bookmark.saved_from_bookmark_id ? "reshare" : "followed_save",
            row.bookmark,
            row.author
          )
        ),
    ]
      // The cap is on the candidate set, taken newest-first, so a very active
      // graph cannot make one request unboundedly expensive.
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, parameters.candidateCap);

    // The Unread scope does not rank. It is a chronological list of the user's
    // own unread saves, and running six signals over it would make it a
    // different list with the same name.
    if (scope === "unread") {
      const chronological = [...pending, ...ranked].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      const session = this.materialise(
        userId,
        scope,
        config,
        now,
        chronological.map((candidate) =>
          this.toSessionEntry(candidate.type, candidate.bookmark, candidate.actor)
        )
      );

      return {
        session,
        metrics: {
          cacheHit: false,
          candidateCount: chronological.length,
          interestVectorMs: 0,
          totalMs: Date.now() - startedAt,
        },
      };
    }

    const bookmarkIds = ranked.map((candidate) => candidate.bookmark.id);
    const interestSince = new Date(
      now.getTime() - parameters.interestWindowDays * DAY_MS
    );

    const interestStartedAt = Date.now();
    const similarity = await this.feedRepository.similarityToInterestVector(
      userId,
      bookmarkIds,
      interestSince
    );
    const interestVectorMs = Date.now() - interestStartedAt;

    const [finishedReads, saveOutcomes, socialProof, impressions, recentlyServed] =
      await Promise.all([
        this.feedRepository.findFinishedReads(
          userId,
          interestSince,
          parameters.candidateCap
        ),
        this.feedRepository.findSaveOutcomes(userId, parameters.candidateCap),
        this.feedRepository.findSocialProof(userId, bookmarkIds),
        this.feedRepository.findImpressions(
          userId,
          bookmarkIds.map((id) => ({
            itemType: "bookmark" as FeedImpressionItemType,
            itemId: id,
          }))
        ),
        this.feedRepository.findRecentlyServed(
          userId,
          parameters.noveltyWindowItems
        ),
      ]);

    const scored = this.score({
      candidates: ranked,
      config,
      now,
      similarity,
      finishedReads,
      saveOutcomes,
      socialProof,
      impressions,
      recentlyServed,
    });

    // Post-processing, in the order docs/functional-spec/05-feed.md gives it.
    // The ×0.6 half of seen decay is already in the scores above, because a
    // multiplier applied after the ordering would not move anything; what is
    // left for this pass is the drop.
    const ordered = applySeenDrop(
      applyDigestSpacing(
        applyAuthorDiversity(
          scored.map((entry) => ({
            ...entry,
            // Own saves carry no author for spacing purposes. Every one of
            // them is "from" the viewer, so keying on the person would make
            // the pass see one endless run, give up, and stop spacing by
            // domain — which is the only dimension a personal library has.
            authorId: entry.candidate.actor
              ? entry.candidate.bookmark.user_id
              : "",
            domain: entry.candidate.domain,
            type: entry.candidate.type,
          })),
          parameters.maxConsecutiveFromSource
        ),
        parameters.digestSpacing,
        parameters.maxDigestsPerSession
      ),
      scope,
      parameters.seenDropAfter
    );

    const entries: SessionEntry[] = [
      // `pending` pins to the top regardless of score, ahead of every pass
      // above: the user made it seconds ago and is watching for it.
      ...pending.map((candidate) =>
        this.toSessionEntry(candidate.type, candidate.bookmark, candidate.actor)
      ),
      ...ordered.map((entry) =>
        this.toSessionEntry(
          entry.candidate.type,
          entry.candidate.bookmark,
          entry.candidate.actor,
          entry.reason,
          entry.signals
        )
      ),
    ];

    return {
      session: this.materialise(userId, scope, config, now, entries),
      metrics: {
        cacheHit: false,
        candidateCount: ranked.length + pending.length,
        interestVectorMs,
        totalMs: Date.now() - startedAt,
      },
    };
  }

  private score(input: {
    candidates: Candidate[];
    config: FeedRankingConfig;
    now: Date;
    similarity: Map<string, number>;
    finishedReads: FinishedReadRow[];
    saveOutcomes: SaveOutcomeRow[];
    socialProof: { bookmarkId: string; reshares: number; likes: number }[];
    impressions: Map<string, { served_count: number; opened_at: Date | null }>;
    recentlyServed: RecentlyServedRow[];
  }): ScoredCandidate[] {
    const { candidates, config, now, similarity } = input;
    const { weights, parameters } = config;

    const outcomes = domainOutcomes(input.saveOutcomes);
    const typical = typicalLength(input.finishedReads, timeOfDayBucket(now));
    const proof = new Map(
      input.socialProof.map((row) => [row.bookmarkId, row])
    );
    const recent = input.recentlyServed.map((row) => ({
      domain: domainOf(row.sourceUrl),
      tags: row.tags ?? [],
    }));

    // The interest vector's fallback. Only consulted when the embedding path
    // produced nothing for this candidate — a brand-new account, or a save the
    // pipeline has not embedded yet.
    const finishedTags = finishedTagWeights(
      input.finishedReads.map((row) => ({ cosmicTags: row.tags }))
    );
    const tagFallback = (tags: string[]): number => {
      if (finishedTags.size === 0 || tags.length === 0) return 0.5;
      const hits = tags.filter((tag) =>
        finishedTags.has(tag.toLowerCase())
      ).length;
      return hits / tags.length;
    };

    return candidates.map((candidate) => {
      const id = candidate.bookmark.id;

      const rawSimilarity = similarity.get(id);
      const topic =
        rawSimilarity === undefined
          ? tagFallback(candidate.tags)
          : // Cosine similarity is -1..1; the score is 0..1, and a vector
            // pointing the other way is uninteresting rather than negative.
            clamp((rawSimilarity + 1) / 2, 0, 1);

      const outcome = outcomes.get(candidate.domain) ?? { saved: 0, finished: 0 };
      const source = sourceAffinityScore(outcome.finished, outcome.saved);

      const recency = recencyScore(
        candidate.createdAt,
        now,
        parameters.recencyHalfLifeDays
      );

      const proofRow = proof.get(id);
      const socialCount = proofRow ? proofRow.reshares + proofRow.likes : 0;
      const social = socialProofScore(socialCount, parameters.socialProofCap);

      const readingTime = readingTimeOf(candidate.bookmark);
      const effort = effortFitScore(readingTime, typical);

      const novelty = noveltyScore(candidate.domain, candidate.tags, recent);

      const values: Record<FeedSignalName, number> = {
        topic_affinity: topic,
        source_affinity: source,
        recency,
        social_proof: social,
        effort_fit: effort,
        novelty,
      };

      const signals: RankingSignal[] = FEED_SIGNAL_NAMES.map((name) => ({
        name,
        weight: weights[name],
        value: values[name],
        contribution: weights[name] * values[name],
      }));

      const base = signals.reduce(
        (total, signal) => total + signal.contribution,
        0
      );

      const impression = input.impressions.get(impressionKey("bookmark", id));
      const unopenedServes =
        impression && impression.opened_at === null ? impression.served_count : 0;

      const score =
        base *
        seenDecayMultiplier(
          unopenedServes,
          parameters.seenDecayAfter,
          parameters.seenDecayFactor
        );

      const reason = buildRankingReason(signals, {
        isOwn: candidate.actor === null,
        actorName: candidate.actor
          ? candidate.actor.name ??
            (candidate.actor.handle ? `@${candidate.actor.handle}` : null)
          : null,
        domain: candidate.domain,
        ageLabel: ageLabel(candidate.createdAt, now),
        socialCount,
        topTag: candidate.tags[0] ?? null,
      });

      return { candidate, score, signals, reason, unopenedServes };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // A stable tiebreak, so two requests a second apart do not reshuffle
      // items that scored identically.
      return (
        b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime() ||
        a.candidate.bookmark.id.localeCompare(b.candidate.bookmark.id)
      );
    });
  }

  private materialise(
    userId: string,
    scope: FeedScope,
    config: FeedRankingConfig,
    now: Date,
    entries: SessionEntry[]
  ): RankedSession {
    const session: RankedSession = {
      token: `${now.getTime()}`,
      computedAt: now,
      entries,
      headExpiresAt: now.getTime() + config.parameters.cacheTtlSeconds * 1000,
      expiresAt: now.getTime() + config.parameters.sessionTtlSeconds * 1000,
    };

    this.store(userId, scope, session, now);
    return session;
  }

  private toSessionEntry(
    type: FeedItemType,
    row: BookmarkRow,
    author: PublicProfileRow | null,
    reason?: string,
    signals?: RankingSignal[]
  ): SessionEntry {
    const item: FeedItem = {
      type,
      bookmark: mapDatabaseRowToBookmark(row),
    };

    if (author) item.actor = toFeedActor(author);
    // `pending` is pinned rather than ranked, so it has nothing to explain.
    if (reason && type !== "pending") item.rankingReason = reason;
    if (signals) item.signals = signals;

    return { item, itemType: "bookmark", itemId: row.id };
  }

  private async pageFrom(
    userId: string,
    session: RankedSession,
    position: number,
    limit: number,
    scope: FeedScope,
    metrics: FeedRankingMetrics
  ): Promise<FeedPage> {
    const start = Math.max(0, position);
    const slice = session.entries.slice(start, start + limit);
    const end = start + slice.length;

    if (slice.length > 0) {
      // Recorded before the response is written, and never awaited into the
      // critical path's failure modes — a write that fails here costs a little
      // ranking accuracy, not the page.
      try {
        await this.feedRepository.recordImpressions(
          userId,
          slice.map((entry) => ({
            itemType: entry.itemType,
            itemId: entry.itemId,
          }))
        );
      } catch {
        // Intentionally ignored. See above.
      }
    }

    return {
      items: slice.map((entry) => entry.item),
      nextCursor:
        end < session.entries.length
          ? { scope, session: session.token, position: end }
          : null,
      computedAt: session.computedAt,
      metrics,
    };
  }
}

// ---------------------------------------------------------------------------
// Small mappings
// ---------------------------------------------------------------------------

function toCandidate(
  type: FeedItemType,
  row: BookmarkRow,
  author: PublicProfileRow | null
): Candidate {
  return {
    type,
    bookmark: row,
    actor: author,
    createdAt: row.created_at,
    domain: domainOf(row.source_url),
    tags: row.cosmic_tags ?? [],
  };
}

function toFeedActor(row: PublicProfileRow): FeedActor {
  return {
    id: row.id,
    handle: row.handle ?? "",
    name: row.name ?? undefined,
    pictureUrl: row.picture_url ?? undefined,
  };
}

function readingTimeOf(row: BookmarkRow): number | null {
  const value = (row.metadata as { readingTime?: unknown } | null)?.readingTime;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Re-exported for the API layer, which owns the opaque cursor encoding. */
export type { Bookmark as FeedBookmark };
