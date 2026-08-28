/**
 * The ranker's numbers, in one place.
 *
 * docs/functional-spec/05-feed.md is explicit that the six weights are "a
 * starting point, not a contract" and that they "belong in configuration, not
 * in scattered constants, so they can be tuned without a deploy". This file is
 * the *fallback* half of that: the values compiled into the build. The other
 * half is one `feed_ranking_config` row per environment, read at request time
 * and merged over these — see `FeedRankingConfigRepository`.
 *
 * Merged, not replaced. An empty table, a missing row, a row carrying three of
 * the six weights, or a row someone typed a string into all produce a working
 * ranker, because every field falls back independently. The table is a set of
 * overrides; this file is the definition.
 *
 * Nothing here rewards engagement time or popularity alone, and there is no
 * knob that could make it. `social_proof` is the only signal that counts other
 * people at all, and it is both log-scaled and capped — see `SOCIAL_PROOF_CAP`
 * in the ranking service, and the test that pins the property.
 */

/** The six signals, by the name they carry in `RankingSignal.name`. */
export const FEED_SIGNAL_NAMES = [
  "topic_affinity",
  "source_affinity",
  "recency",
  "social_proof",
  "effort_fit",
  "novelty",
] as const;

export type FeedSignalName = (typeof FEED_SIGNAL_NAMES)[number];

export type FeedSignalWeights = Record<FeedSignalName, number>;

/**
 * The starting weights, verbatim from the spec's table. They sum to 1.0, which
 * is a convenience rather than a requirement — the score is a weighted sum and
 * only its ordering matters — but a set that does not sum to 1 makes the
 * reason sentences harder to reason about, so the loader normalises nothing
 * and the test asserts the default.
 */
export const DEFAULT_FEED_WEIGHTS: FeedSignalWeights = {
  topic_affinity: 0.35,
  source_affinity: 0.15,
  recency: 0.2,
  social_proof: 0.15,
  effort_fit: 0.1,
  novelty: 0.05,
};

/**
 * Everything else that is a number rather than a policy.
 *
 * The distinction that matters: these are tunable, but the *order* of the
 * post-processing passes and the fact that `pending` pins to the top are not.
 * Those are product decisions and they live in code, where a config row cannot
 * quietly reverse them.
 */
export interface FeedRankingParameters {
  /** Hard cap on the candidate set, before ranking. */
  candidateCap: number;
  /** Default page size. */
  pageSize: number;
  /** Ceiling on a client-supplied `limit`. */
  maxPageSize: number;
  /** How far back own unread saves are eligible. */
  ownUnreadWindowDays: number;
  /** How far back followed public saves are eligible. */
  followedWindowDays: number;
  /** Exponential decay on `created_at`. */
  recencyHalfLifeDays: number;
  /** Window for the mean-embedding interest vector. */
  interestWindowDays: number;
  /**
   * The count at which log-scaled social proof reaches 1.0. Above it the
   * signal is flat: this is the "capped so no item can win on popularity
   * alone" clause, expressed as a number.
   */
  socialProofCap: number;
  /** Unopened impressions before the score is multiplied by `seenDecayFactor`. */
  seenDecayAfter: number;
  /** The multiplier itself. */
  seenDecayFactor: number;
  /** Unopened impressions before the item leaves For you entirely. */
  seenDropAfter: number;
  /** Author diversity: how many in a row from one person or domain. */
  maxConsecutiveFromSource: number;
  /** Digest spacing: at most one digest per this many items. */
  digestSpacing: number;
  /** Digest spacing: and no more than this many in a session. */
  maxDigestsPerSession: number;
  /** How long the ranked head stays warm, in seconds. */
  cacheTtlSeconds: number;
  /**
   * How long a paging session stays resumable, in seconds. Longer than the
   * head TTL on purpose: a reader who is three pages in should not have their
   * cursor evaporate because the head went stale behind them.
   */
  sessionTtlSeconds: number;
  /** How many recently-served items the novelty penalty looks back over. */
  noveltyWindowItems: number;
}

export const DEFAULT_FEED_RANKING_PARAMETERS: FeedRankingParameters = {
  candidateCap: 500,
  pageSize: 20,
  maxPageSize: 50,
  ownUnreadWindowDays: 90,
  followedWindowDays: 14,
  recencyHalfLifeDays: 7,
  interestWindowDays: 60,
  socialProofCap: 5,
  seenDecayAfter: 3,
  seenDecayFactor: 0.6,
  seenDropAfter: 5,
  maxConsecutiveFromSource: 2,
  digestSpacing: 8,
  maxDigestsPerSession: 3,
  cacheTtlSeconds: 300,
  sessionTtlSeconds: 900,
  noveltyWindowItems: 20,
};

export interface FeedRankingConfig {
  weights: FeedSignalWeights;
  parameters: FeedRankingParameters;
}

export const DEFAULT_FEED_RANKING_CONFIG: FeedRankingConfig = {
  weights: DEFAULT_FEED_WEIGHTS,
  parameters: DEFAULT_FEED_RANKING_PARAMETERS,
};

/** What a `feed_ranking_config` row can carry. Every field optional. */
export interface FeedRankingConfigOverrides {
  weights?: unknown;
  parameters?: unknown;
}

/**
 * A finite, non-negative number, or nothing.
 *
 * Deliberately strict about what it accepts and silent about what it rejects.
 * A config row is edited by a human with a SQL client at 2am; a typo in one
 * weight must degrade to the default for that weight, not take the feed down
 * and not produce a NaN score that sorts unpredictably.
 */
function finiteNonNegative(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;
  return value;
}

/** Same, but must be at least 1 — a page size of 0 is not a tuning. */
function positiveInteger(value: unknown): number | undefined {
  const numeric = finiteNonNegative(value);
  if (numeric === undefined) return undefined;
  const rounded = Math.floor(numeric);
  return rounded >= 1 ? rounded : undefined;
}

const INTEGER_PARAMETERS: ReadonlySet<keyof FeedRankingParameters> = new Set([
  "candidateCap",
  "pageSize",
  "maxPageSize",
  "ownUnreadWindowDays",
  "followedWindowDays",
  "interestWindowDays",
  "seenDecayAfter",
  "seenDropAfter",
  "maxConsecutiveFromSource",
  "digestSpacing",
  "maxDigestsPerSession",
  "cacheTtlSeconds",
  "sessionTtlSeconds",
  "noveltyWindowItems",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The file values with the row's overrides merged over them, field by field.
 *
 * Unknown keys are ignored rather than carried: a row with `"trending": 0.3`
 * in it does not add a trending boost, it adds nothing. That is the point —
 * the set of signals is code, and only their weights are configuration.
 */
export function mergeFeedRankingConfig(
  overrides: FeedRankingConfigOverrides | null | undefined
): FeedRankingConfig {
  const weights: FeedSignalWeights = { ...DEFAULT_FEED_WEIGHTS };
  const parameters: FeedRankingParameters = {
    ...DEFAULT_FEED_RANKING_PARAMETERS,
  };

  const rawWeights = overrides?.weights;
  if (isRecord(rawWeights)) {
    for (const name of FEED_SIGNAL_NAMES) {
      const candidate = finiteNonNegative(rawWeights[name]);
      if (candidate !== undefined) weights[name] = candidate;
    }
  }

  const rawParameters = overrides?.parameters;
  if (isRecord(rawParameters)) {
    for (const key of Object.keys(parameters) as (keyof FeedRankingParameters)[]) {
      const candidate = INTEGER_PARAMETERS.has(key)
        ? positiveInteger(rawParameters[key])
        : finiteNonNegative(rawParameters[key]);
      if (candidate !== undefined) parameters[key] = candidate;
    }
  }

  return { weights, parameters };
}
