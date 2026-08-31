import { z } from "zod";
import { AI } from "../ai";
import { FeedDigestRow } from "../database/schema";
import {
  DigestCandidateSave,
  DigestRepository,
  digestDomainOf,
  mapDigestSources,
  parseKeyPoints,
} from "../repositories/digest.repository";
import { Digest, DigestKeyPoint } from "../types";
import { BOOKMARK_MODEL_IDS } from "./bookmark.model-ids";
import {
  DEFAULT_DIGEST_CONFIG,
  DigestGenerationConfig,
  DigestSkipReason,
} from "./digest.config";
import { buildDigestPrompt, buildDigestSourceBlock } from "./digest.prompt";

/**
 * Digests — docs/functional-spec/05-feed.md § Digests.
 *
 * The deliverable's promise is a negative one: **an incoherent cluster
 * produces nothing.** Everything in this file is arranged around making that
 * checkable rather than hopeful.
 *
 *  - The gates are geometry first, in `assessCluster`, against named
 *    thresholds in `digest.config.ts`. They are pure functions over vectors,
 *    so the property can be asserted with no database and no model.
 *  - **The model is not called until the geometry passes.** This is the part
 *    that would be easy to get subtly wrong: asking a model to summarise a
 *    group it was handed is asking it to find a pattern, and it will find one.
 *    A weak cluster never reaches the prompt.
 *  - The model can still refuse, and its refusal ends the run. Two independent
 *    gates, and either one produces no digest.
 *
 * The other promise is provenance: **a digest names every bookmark it was
 * built from.** The cluster's member ids are what is written to
 * `source_bookmark_ids`, in cluster order, and nothing between here and the
 * feed item truncates them.
 */

// ---------------------------------------------------------------------------
// The model's answer
// ---------------------------------------------------------------------------

export const DigestResponseSchema = z.object({
  /** The model's own refusal. `false` ends the run — see the prompt. */
  coherent: z.boolean(),
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(
    z.object({
      term: z.string().nullable().optional(),
      text: z.string(),
    })
  ),
});

export type DigestResponse = z.infer<typeof DigestResponseSchema>;

// ---------------------------------------------------------------------------
// Clustering — pure, and the whole of "genuinely coherent"
// ---------------------------------------------------------------------------

/** What a candidate cluster measured, and whether it cleared every gate. */
export interface ClusterAssessment {
  members: DigestCandidateSave[];
  /** Mean pairwise cosine similarity across the cluster. */
  coherence: number;
  /** The weakest single pair in it — the outlier detector. */
  weakestPair: number;
  distinctDomains: number;
  /** True only when every gate in the configuration is cleared. */
  coherent: boolean;
}

/**
 * Cosine similarity. Returns 0 for mismatched or empty vectors rather than
 * throwing: a vector the pipeline never wrote is "unrelated to everything",
 * which is true and is also the safe direction to be wrong in.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const value = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Measure a candidate cluster against every gate.
 *
 * Four numbers decide it, and all four are reported whether it passes or not,
 * so a rejection can be explained rather than merely logged:
 *
 *  - size, between `minClusterSize` and `maxClusterSize`;
 *  - `coherence`, the mean pairwise similarity;
 *  - `weakestPair`, which stops one unrelated save from riding along on a good
 *    average — the failure mode a mean alone cannot see;
 *  - `distinctDomains`, because three posts from one blog are that blog's
 *    output, not a pattern in someone's reading.
 */
export function assessCluster(
  members: DigestCandidateSave[],
  config: DigestGenerationConfig
): ClusterAssessment {
  const domains = new Set(members.map((save) => digestDomainOf(save.url)));

  let total = 0;
  let pairs = 0;
  let weakest = 1;

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const similarity = cosineSimilarity(
        members[i].embedding,
        members[j].embedding
      );
      total += similarity;
      pairs += 1;
      if (similarity < weakest) weakest = similarity;
    }
  }

  // A single item has no pairs. Coherence is undefined rather than perfect,
  // and 0 is the honest way to say so — it fails every gate, which is right.
  const coherence = pairs === 0 ? 0 : total / pairs;
  const weakestPair = pairs === 0 ? 0 : weakest;

  const coherent =
    members.length >= config.minClusterSize &&
    members.length <= config.maxClusterSize &&
    coherence >= config.coherence &&
    weakestPair >= config.minPairSimilarity &&
    domains.size >= config.minDistinctDomains;

  return {
    members,
    coherence,
    weakestPair,
    distinctDomains: domains.size,
    coherent,
  };
}

/**
 * The best cluster in a window, or `null` when there is nothing to assess.
 *
 * Deliberately simple: every save's neighbourhood — itself plus everything
 * within `linkSimilarity` of it — is a candidate, taken nearest-first and
 * capped at `maxClusterSize`. A neighbourhood that fails only because of one
 * outlier is retried without its weakest member, down to `minClusterSize`.
 *
 * No k-means, no fixed cluster count, no random seeds. The number of clusters
 * a fortnight of reading contains is not knowable in advance, and a
 * non-deterministic clusterer would make "why did I get this digest" an
 * unanswerable question.
 *
 * Returns the best cluster **whether or not it is coherent**, so the caller can
 * report the measurement it fell short on. Only `coherent === true` may
 * produce a digest.
 */
export function findBestCluster(
  saves: DigestCandidateSave[],
  config: DigestGenerationConfig
): ClusterAssessment | null {
  if (saves.length < config.minClusterSize) return null;

  // Deterministic input order: same window, same digest, every time.
  const ordered = [...saves].sort((a, b) =>
    a.bookmarkId.localeCompare(b.bookmarkId)
  );

  let best: ClusterAssessment | null = null;

  for (const seed of ordered) {
    const neighbours = ordered
      .filter((save) => save.bookmarkId !== seed.bookmarkId)
      .map((save) => ({
        save,
        similarity: cosineSimilarity(seed.embedding, save.embedding),
      }))
      .filter((entry) => entry.similarity >= config.linkSimilarity)
      .sort(
        (a, b) =>
          b.similarity - a.similarity ||
          a.save.bookmarkId.localeCompare(b.save.bookmarkId)
      );

    let members = [seed, ...neighbours.map((entry) => entry.save)].slice(
      0,
      config.maxClusterSize
    );

    if (members.length < config.minClusterSize) continue;

    let assessment = assessCluster(members, config);

    // Shed outliers, one at a time, while that is still allowed to leave a
    // cluster. The seed is never dropped: it is the thing the neighbourhood is
    // a neighbourhood of.
    while (!assessment.coherent && members.length > config.minClusterSize) {
      const weakest = weakestMemberIndex(members);
      if (weakest <= 0) break;
      members = members.filter((_, index) => index !== weakest);
      assessment = assessCluster(members, config);
    }

    if (isBetter(assessment, best)) best = assessment;
  }

  return best;
}

/** The member with the lowest mean similarity to the rest. Never the seed. */
function weakestMemberIndex(members: DigestCandidateSave[]): number {
  let worstIndex = -1;
  let worstMean = Number.POSITIVE_INFINITY;

  for (let i = 1; i < members.length; i += 1) {
    let total = 0;
    for (let j = 0; j < members.length; j += 1) {
      if (i === j) continue;
      total += cosineSimilarity(members[i].embedding, members[j].embedding);
    }
    const mean = total / (members.length - 1);
    if (mean < worstMean) {
      worstMean = mean;
      worstIndex = i;
    }
  }

  return worstIndex;
}

function isBetter(
  candidate: ClusterAssessment,
  incumbent: ClusterAssessment | null
): boolean {
  if (!incumbent) return true;
  // A coherent cluster beats an incoherent one whatever their means say: the
  // gates are the question, and the mean is only the tiebreak among answers.
  if (candidate.coherent !== incumbent.coherent) return candidate.coherent;
  if (candidate.coherence !== incumbent.coherence) {
    return candidate.coherence > incumbent.coherence;
  }
  return candidate.members.length > incumbent.members.length;
}

// ---------------------------------------------------------------------------
// The service
// ---------------------------------------------------------------------------

export type DigestGenerationResult =
  | { outcome: "created"; digest: Digest }
  | {
      outcome: "skipped";
      reason: DigestSkipReason;
      /** The best measurement the run managed, when it got that far. */
      coherence?: number;
      clusterSize?: number;
    };

export interface DigestShareResult {
  isPublic: boolean;
  shareUrl: string;
}

export interface DigestLikeResult {
  likeCount: number;
  isLikedByCurrentUser: boolean;
}

export interface DigestService {
  /**
   * One scheduled run for one user. Called by the worker's queue handler, not
   * by a request: a digest is generated on a schedule, never per page view.
   */
  generateForUser(
    userId: string,
    options?: { now?: Date }
  ): Promise<DigestGenerationResult>;

  /**
   * One digest, owner-unless-public — the same rule the table's RLS states.
   * Returns `null` for both "does not exist" and "not yours and not shared":
   * a private digest does not confirm its own existence.
   */
  findForViewer(digestId: string, viewerId: string): Promise<Digest | null>;

  /** Hydrate digest rows the ranker already read, for the feed page. */
  hydrate(rows: FeedDigestRow[], viewerId: string): Promise<Map<string, Digest>>;

  like(viewerId: string, digestId: string): Promise<DigestLikeResult | null>;
  unlike(viewerId: string, digestId: string): Promise<DigestLikeResult | null>;

  /**
   * Publish the digest. **Never its sources** — resharing a digest saves the
   * digest, and the bookmarks it names stay exactly as private as they were.
   */
  share(digestId: string, userId: string): Promise<DigestShareResult | null>;
  unshare(digestId: string, userId: string): Promise<DigestShareResult | null>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class DigestServiceImpl implements DigestService {
  constructor(
    private digestRepository: DigestRepository,
    private ai: AI,
    private config: DigestGenerationConfig = DEFAULT_DIGEST_CONFIG
  ) {}

  async generateForUser(
    userId: string,
    options: { now?: Date } = {}
  ): Promise<DigestGenerationResult> {
    const now = options.now ?? new Date();
    const windowStart = new Date(now.getTime() - this.config.windowDays * DAY_MS);

    // pgmq is at-least-once, and two worker replicas tick their schedulers
    // independently. The job refuses rather than the queue guaranteeing —
    // a delivery guarantee is not a product rule.
    const recent = await this.digestRepository.hasRecentDigest(
      userId,
      new Date(now.getTime() - this.config.userCooldownDays * DAY_MS)
    );
    if (recent) {
      return { outcome: "skipped", reason: "cooldown" };
    }

    const [saves, alreadyUsed] = await Promise.all([
      this.digestRepository.findCandidateSaves(
        userId,
        windowStart,
        this.config.maxCandidateSaves
      ),
      this.digestRepository.findRecentlyDigestedBookmarkIds(
        userId,
        new Date(now.getTime() - this.config.sourceCooldownDays * DAY_MS)
      ),
    ]);

    // A save that has already been in a digest is out. Clusters are stable
    // across a fortnight, so without this the same four saves produce the same
    // observation every night — which is how a feature people liked once
    // becomes one they mute.
    const eligible = saves.filter(
      (save) => !alreadyUsed.has(save.bookmarkId)
    );

    if (eligible.length < this.config.minClusterSize) {
      return { outcome: "skipped", reason: "not_enough_saves" };
    }

    const cluster = findBestCluster(eligible, this.config);

    if (!cluster) {
      return { outcome: "skipped", reason: "not_enough_saves" };
    }

    // The gate. Nothing below this line runs for a weak cluster — in
    // particular, the model is never asked.
    if (!cluster.coherent) {
      return {
        outcome: "skipped",
        reason: "no_coherent_cluster",
        coherence: cluster.coherence,
        clusterSize: cluster.members.length,
      };
    }

    const response = await this.ask(userId, cluster);

    if (!response.coherent) {
      return {
        outcome: "skipped",
        reason: "model_declined",
        coherence: cluster.coherence,
        clusterSize: cluster.members.length,
      };
    }

    const keyPoints = normaliseKeyPoints(response.keyPoints);
    const title = response.title.trim();
    const summary = response.summary.trim();

    // A "yes" with nothing behind it is a no. Two key points is the floor from
    // docs/functional-spec/03-ai-pipeline.md; one finding is a sentence, not an
    // observation.
    if (title === "" || summary === "" || keyPoints.length < 2) {
      return {
        outcome: "skipped",
        reason: "model_incomplete",
        coherence: cluster.coherence,
        clusterSize: cluster.members.length,
      };
    }

    const row = await this.digestRepository.create({
      userId,
      title,
      summary,
      keyPoints,
      // Every member of the cluster, in cluster order. This is the provenance
      // guarantee: the digest is written from exactly these, and it names
      // exactly these.
      sourceBookmarkIds: cluster.members.map((save) => save.bookmarkId),
      coherence: clamp01(cluster.coherence),
      modelId: BOOKMARK_MODEL_IDS.large,
      windowStart,
      windowEnd: now,
    });

    const digest = await this.toDigest(row, false);
    return { outcome: "created", digest };
  }

  async findForViewer(
    digestId: string,
    viewerId: string
  ): Promise<Digest | null> {
    const row = await this.digestRepository.findById(digestId);
    if (!row) return null;
    if (row.user_id !== viewerId && !row.is_public) return null;

    const liked = await this.digestRepository.findLikedBy(viewerId, [row.id]);
    return this.toDigest(row, liked.has(row.id));
  }

  async hydrate(
    rows: FeedDigestRow[],
    viewerId: string
  ): Promise<Map<string, Digest>> {
    if (rows.length === 0) return new Map();

    // One source query for the whole page, not one per digest.
    const bookmarkIds = [
      ...new Set(rows.flatMap((row) => row.source_bookmark_ids ?? [])),
    ];

    const [sourceRows, liked] = await Promise.all([
      this.digestRepository.findSources(bookmarkIds),
      this.digestRepository.findLikedBy(
        viewerId,
        rows.map((row) => row.id)
      ),
    ]);

    return new Map(
      rows.map((row) => [
        row.id,
        toDigestWithSources(
          row,
          mapDigestSources(row.source_bookmark_ids ?? [], sourceRows),
          liked.has(row.id)
        ),
      ])
    );
  }

  async like(
    viewerId: string,
    digestId: string
  ): Promise<DigestLikeResult | null> {
    const row = await this.digestRepository.findById(digestId);
    if (!row) return null;
    // You can like what you can see. The visibility rule is the same one the
    // read path uses, and it is asked here rather than assumed from the fact
    // that the caller had an id.
    if (row.user_id !== viewerId && !row.is_public) return null;

    const likeCount = await this.digestRepository.like(viewerId, digestId);
    return { likeCount, isLikedByCurrentUser: true };
  }

  async unlike(
    viewerId: string,
    digestId: string
  ): Promise<DigestLikeResult | null> {
    const row = await this.digestRepository.findById(digestId);
    if (!row) return null;
    if (row.user_id !== viewerId && !row.is_public) return null;

    const likeCount = await this.digestRepository.unlike(viewerId, digestId);
    return { likeCount, isLikedByCurrentUser: false };
  }

  async share(
    digestId: string,
    userId: string
  ): Promise<DigestShareResult | null> {
    // Scoped to the owner in SQL: `null` back means "not yours, or not there",
    // and the route turns both into a 404.
    //
    // Note what this does *not* touch. Sharing a digest publishes the digest.
    // The source bookmarks keep exactly the visibility they had — a provenance
    // row is not a licence to publish what it names.
    const row = await this.digestRepository.share(digestId, userId);
    if (!row) return null;

    return {
      isPublic: true,
      shareUrl: digestShareUrl(row.share_slug),
    };
  }

  async unshare(
    digestId: string,
    userId: string
  ): Promise<DigestShareResult | null> {
    const row = await this.digestRepository.unshare(digestId, userId);
    if (!row) return null;

    return { isPublic: false, shareUrl: "" };
  }

  private async ask(
    userId: string,
    cluster: ClusterAssessment
  ): Promise<DigestResponse> {
    const session = await this.ai.newSession(`digest:${userId}`);

    const prompt = buildDigestPrompt({
      sources: buildDigestSourceBlock(
        cluster.members.map((save) => ({
          title: save.title,
          url: save.url,
          summary: save.summary,
          tags: save.tags,
        }))
      ),
      coherence: cluster.coherence,
    });

    return this.ai.generateObject({
      sessionID: session.sessionID,
      modelId: BOOKMARK_MODEL_IDS.large,
      prompt,
      schema: DigestResponseSchema,
    });
  }

  private async toDigest(
    row: FeedDigestRow,
    liked: boolean
  ): Promise<Digest> {
    const sourceRows = await this.digestRepository.findSources(
      row.source_bookmark_ids ?? []
    );

    return toDigestWithSources(
      row,
      mapDigestSources(row.source_bookmark_ids ?? [], sourceRows),
      liked
    );
  }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export function toDigestWithSources(
  row: FeedDigestRow,
  sources: Digest["sources"],
  liked: boolean
): Digest {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    keyPoints: parseKeyPoints(row.key_points),
    sources,
    coherence: Number(row.coherence),
    createdAt: row.created_at,
    likeCount: row.like_count,
    isLikedByCurrentUser: liked,
    isPublic: row.is_public,
    ...(row.is_public && row.share_slug
      ? { shareUrl: digestShareUrl(row.share_slug) }
      : {}),
  };
}

/**
 * `/s/d/{slug}`, not `/s/{slug}`.
 *
 * Bookmark share slugs already own `/s/{slug}`, and two id spaces sharing one
 * route is a collision waiting for the first slug that matches both. The extra
 * segment costs nothing and makes the resource unambiguous.
 */
export function digestShareUrl(slug: string | null): string {
  if (!slug) return "";
  const webAppUrl = process.env.WEB_APP_URL || "https://cosmicdolphin.com";
  return `${webAppUrl}/s/d/${slug}`;
}

/** 2–3 findings, trimmed and capped. Never numbered, never more than three. */
function normaliseKeyPoints(
  raw: DigestResponse["keyPoints"]
): DigestKeyPoint[] {
  const points: DigestKeyPoint[] = [];

  for (const entry of raw ?? []) {
    const text = (entry?.text ?? "").trim();
    if (text === "") continue;

    const term = (entry?.term ?? "").trim();
    points.push({ text, ...(term ? { term } : {}) });
    if (points.length === 3) break;
  }

  return points;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
