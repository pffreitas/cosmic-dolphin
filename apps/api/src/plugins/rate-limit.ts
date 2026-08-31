import type { FastifyInstance, FastifyRequest } from "fastify";
import rateLimit, { type RateLimitOptions } from "@fastify/rate-limit";

/**
 * Per-user rate limiting.
 *
 * docs/functional-spec/08-api-surface.md § Conventions fixes three limits:
 * saves 100/day, follows 100/hour, comments 10/min — all of them "429 with
 * `Retry-After`". This module is the one place those are expressed, so a limit
 * is a line of configuration rather than a hand-rolled counter in a handler.
 *
 * Usage, on the route that needs it:
 *
 *   fastify.post("/bookmarks", {
 *     preHandler: authMiddleware,
 *     config: rateLimited(RATE_LIMITS.saves),
 *   }, handler);
 *
 * The limiter runs on `preHandler`, deliberately: the default `onRequest` hook
 * fires before authentication, so `request.userId` would be undefined and
 * everyone behind one NAT would share a bucket. `@fastify/rate-limit` appends
 * its handler to the route's existing `preHandler` array, so `authMiddleware`
 * has already run and the key is the actual user.
 *
 * Storage is the plugin's in-process LRU. That is honest for a single
 * container and approximate across several — the limit becomes per-instance.
 * When the API runs more than one replica in earnest, pass `redis` to
 * `registerRateLimiting` and every policy here becomes exact without a single
 * route changing.
 */

export interface RateLimitPolicy {
  /**
   * Namespaces the counter. Two policies on the same route would otherwise
   * share a bucket and neither limit would mean what it says.
   */
  name: string;
  max: number;
  /** Anything `ms` understands: "1 day", "1 hour", "1 minute". */
  timeWindow: string;
  /**
   * What the user reads. `retryIn` is the human-readable time remaining, so
   * the client can render the wait without doing arithmetic on a header.
   */
  message: (retryIn: string) => string;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Every limit in the product, with an env override apiece so a limit can be
 * raised for an incident without a deploy.
 */
export const RATE_LIMITS = {
  saves: {
    name: "saves",
    max: envInt("RATE_LIMIT_SAVES_MAX", 100),
    timeWindow: process.env.RATE_LIMIT_SAVES_WINDOW ?? "1 day",
    message: (retryIn) =>
      `You have hit today's save limit. Try again in ${retryIn}.`,
  },
  // Retries are cheap to ask for and expensive to serve, and a client stuck in
  // a retry loop would otherwise walk straight through the daily processing
  // budget — which deliberately does not refuse an explicit reprocess. This is
  // the guard rail on that exception, not a second budget.
  // Reading progress is the only endpoint a client writes to on a timer, so
  // it is the only one where a bug in the client — a throttle that resets on
  // every render, a retry loop on a 404 — turns into sustained write load
  // without anyone noticing. The product limit is the 5-second client throttle
  // (`PROGRESS_WRITE_INTERVAL_MS`); this is the ceiling that keeps a broken
  // client from becoming an incident, set an order of magnitude above what a
  // person reading several things at once can legitimately generate.
  progress: {
    name: "progress",
    max: envInt("RATE_LIMIT_PROGRESS_MAX", 300),
    timeWindow: process.env.RATE_LIMIT_PROGRESS_WINDOW ?? "5 minutes",
    message: (retryIn) =>
      `Too many reading-progress updates. Try again in ${retryIn}.`,
  },
  // docs/functional-spec/06-social.md § Abuse and moderation. A follow is one
  // row and no notification, so the cost of an individual one is negligible —
  // what this bounds is the *pattern*: follow-unfollow churn to farm attention,
  // and mass-following to seed a feed. A hundred an hour is far above what
  // reading someone's profile and deciding to follow them looks like, and far
  // below what a script does.
  follows: {
    name: "follows",
    max: envInt("RATE_LIMIT_FOLLOWS_MAX", 100),
    timeWindow: process.env.RATE_LIMIT_FOLLOWS_WINDOW ?? "1 hour",
    message: (retryIn) =>
      `You have followed a lot of people just now. Try again in ${retryIn}.`,
  },
  // docs/functional-spec/06-social.md § Comment: "rate limited to 10 per
  // minute per user". Tighter than follows by two orders of magnitude, and
  // deliberately so — a comment is the only thing in this product one user can
  // put in front of another, and the abuse pattern it bounds is a burst, not a
  // sustained rate. Ten a minute is faster than anyone types something worth
  // reading and slower than a script is worth writing.
  comments: {
    name: "comments",
    max: envInt("RATE_LIMIT_COMMENTS_MAX", 10),
    timeWindow: process.env.RATE_LIMIT_COMMENTS_WINDOW ?? "1 minute",
    message: (retryIn) =>
      `You are commenting very quickly. Try again in ${retryIn}.`,
  },
  reprocess: {
    name: "reprocess",
    max: envInt("RATE_LIMIT_REPROCESS_MAX", 30),
    timeWindow: process.env.RATE_LIMIT_REPROCESS_WINDOW ?? "1 hour",
    message: (retryIn) =>
      `Too many reprocessing requests. Try again in ${retryIn}.`,
  },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Registers the limiter itself. `global: false` — nothing is limited unless a
 * route asks for it, because a limit nobody chose is a limit nobody can reason
 * about.
 */
export function registerRateLimiting(
  server: FastifyInstance,
  options: { redis?: unknown } = {}
): void {
  // Must be queued BEFORE the routes it limits, and those routes must live
  // inside a registered plugin rather than straight on the root instance. The
  // limiter attaches itself through an `onRoute` hook that does not exist
  // until its own plugin has booted; a route declared directly on the root is
  // registered first, and its `config.rateLimit` is then ignored in silence —
  // no error, no limit. `src/index.ts` has the right shape; so does the
  // harness in `src/tests/rate-limit.test.ts`.
  server.register(rateLimit, {
    global: false,
    // Makes `Retry-After` the seconds actually remaining rather than the full
    // window. "Try again in 3 minutes" is useful; "try again in 24 hours"
    // twenty-three hours into the window is a lie.
    enableDraftSpec: true,
    ...(options.redis ? { redis: options.redis } : {}),
  });

  // The plugin throws an Error, which Fastify serialises as
  // `{ statusCode, error, message }`. Every other error in this API is
  // `CosmicError { code, message }`-shaped — `{ error }` on the wire — so
  // reshape the 429 rather than making clients special-case one status code.
  //
  // Returning nothing is load-bearing: Fastify re-sends whatever an error
  // handler returns, so handing back the reply object sends the response
  // twice and the second write throws ERR_HTTP_HEADERS_SENT.
  server.setErrorHandler((error, _request, reply) => {
    if (error.statusCode === 429) {
      reply.status(429).send({ error: error.message });
      return;
    }
    // Anything else is passed straight back, which re-enters Fastify's own
    // default handler — this reshapes one status code and nothing else.
    reply.send(error);
  });
}

/**
 * The route-level `config` for a policy. Pass the result straight to
 * `config:` on the route definition.
 */
export function rateLimited(policy: RateLimitPolicy): {
  rateLimit: RateLimitOptions;
} {
  return {
    rateLimit: {
      max: policy.max,
      timeWindow: policy.timeWindow,
      hook: "preHandler",
      keyGenerator: (request: FastifyRequest) =>
        `${policy.name}:${request.userId ?? request.ip}`,
      errorResponseBuilder: (_request, context) => {
        const error = new Error(policy.message(context.after)) as Error & {
          statusCode: number;
        };
        // No policy here sets `ban`, so the only status this builder is ever
        // asked for is 429.
        error.statusCode = 429;
        return error;
      },
    },
  };
}
