/**
 * The digest generator's numbers, in one place — docs/functional-spec/05-feed.md
 * § Digests.
 *
 * The deliverable's whole point lives in this file: *a weak cluster produces
 * no digest*. That sentence is only worth anything if "weak" is a number
 * somebody can read, argue with, and write a test against, so every gate the
 * generator applies is a named constant here rather than a literal buried in a
 * loop.
 *
 * Three gates, in order, and each one can end the run on its own:
 *
 *   1. **`linkSimilarity`** — how close two saves must be to be in the same
 *      neighbourhood at all. This shapes the candidate clusters.
 *   2. **`coherence`** — the mean pairwise similarity the *whole* cluster must
 *      clear, plus `minPairSimilarity`, which stops one outlier from riding
 *      along on a good average. A cluster that fails here is dropped **before
 *      any model call is made**: there is nothing to ask about, and asking
 *      anyway is how a model gets talked into finding a pattern in noise.
 *   3. **The model's own refusal** — it is told that "these do not belong
 *      together" is a valid answer, and it is taken at its word.
 *
 * The thresholds are cosine similarities between mean chunk embeddings of
 * whole documents, which run high: two unrelated English articles sit around
 * 0.6–0.7, so the bar is set well above that rather than at the 0.3–0.4 that
 * would be meaningful for sentence-level vectors.
 */
export interface DigestGenerationConfig {
  /** How far back the clustering window reaches. The spec says 14 days. */
  windowDays: number;

  /** Hard cap on saves pulled into one clustering run. */
  maxCandidateSaves: number;

  /** A digest groups 3–6 saves. Two are a coincidence; seven are a reading list. */
  minClusterSize: number;
  maxClusterSize: number;

  /** Cosine similarity at which two saves are neighbours. */
  linkSimilarity: number;

  /** Mean pairwise cosine similarity the cluster must clear. */
  coherence: number;

  /**
   * The floor under every individual pair in the cluster. A cluster of four
   * where three are tight and the fourth is unrelated has a respectable mean
   * and is not an observation — this is the gate that catches it.
   */
  minPairSimilarity: number;

  /**
   * Distinct domains required. Three posts from one blog are that blog's
   * output, not a pattern in someone's reading.
   */
  minDistinctDomains: number;

  /** How long a save is off-limits after appearing in a digest. */
  sourceCooldownDays: number;

  /** How long after receiving a digest a user is skipped by the scheduler. */
  userCooldownDays: number;

  /** Saves in the window before a user is worth enqueueing at all. */
  minSavesForJob: number;

  /** How many users one scheduled tick enqueues. */
  maxUsersPerTick: number;
}

export const DEFAULT_DIGEST_CONFIG: DigestGenerationConfig = {
  windowDays: 14,
  maxCandidateSaves: 200,
  minClusterSize: 3,
  maxClusterSize: 6,
  linkSimilarity: 0.78,
  coherence: 0.8,
  minPairSimilarity: 0.72,
  minDistinctDomains: 2,
  sourceCooldownDays: 30,
  userCooldownDays: 3,
  minSavesForJob: 3,
  maxUsersPerTick: 500,
};

/**
 * Why a run produced nothing.
 *
 * Every one of these is an ordinary outcome, not an error. They are
 * distinguished so an operator can tell "this person saves unrelated things"
 * from "the model refused" from "nothing was embedded yet" — three very
 * different reasons for an empty feed, only one of which is worth acting on.
 */
export type DigestSkipReason =
  /** This user already has a digest inside `userCooldownDays`. */
  | "cooldown"
  /** Fewer than `minClusterSize` embedded saves in the window. */
  | "not_enough_saves"
  /** Saves exist, but no group of them clears the coherence gates. */
  | "no_coherent_cluster"
  /** The cluster cleared the geometry and the model still said no. */
  | "model_declined"
  /** The model answered, but not with a usable thesis and key points. */
  | "model_incomplete";
