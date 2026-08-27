import { describe, it, expect } from "bun:test";
import Fastify, { FastifyInstance } from "fastify";

import {
  RATE_LIMITS,
  rateLimited,
  registerRateLimiting,
  type RateLimitPolicy,
} from "../plugins/rate-limit";

/**
 * The rate-limit primitive, on its own.
 *
 * Saves are the first consumer (100/day, docs/functional-spec/02-capture.md
 * § Failure) but follows and comments land on the same helper, so what is
 * tested here is the helper: per-user buckets, a 429 shaped like every other
 * error in this API, and a `Retry-After` the client can render as a wait.
 *
 * These bind a real socket rather than using `fastify.inject` — `light-my-
 * request` does not survive Bun's test runner, and a rate limiter is exactly
 * the kind of thing worth exercising over an actual connection anyway.
 */

const TEST_POLICY: RateLimitPolicy = {
  name: "test",
  max: 2,
  timeWindow: "1 minute",
  message: (retryIn) => `Slow down. Try again in ${retryIn}.`,
};

/**
 * A stand-in for `authMiddleware`: reads the user out of a header so a test
 * can be two different people without a Supabase round trip. Registered the
 * same way the real one is — as the route's `preHandler` — because the point
 * of several assertions below is that the limiter runs *after* it and
 * therefore sees a user id rather than an address.
 */
async function fakeAuth(request: { userId?: string; headers: any }) {
  request.userId = request.headers["x-test-user"];
}

interface Harness {
  origin: string;
  post: (path: string, user: string) => Promise<Response>;
  close: () => Promise<void>;
}

async function start(app: FastifyInstance): Promise<Harness> {
  const origin = await app.listen({ port: 0, host: "127.0.0.1" });
  return {
    origin,
    post: (path, user) =>
      fetch(`${origin}${path}`, {
        method: "POST",
        headers: { "x-test-user": user },
      }),
    close: () => app.close(),
  };
}

/**
 * Routes go inside a registered plugin, not straight onto the root instance —
 * the same shape as `src/index.ts`. It is load-bearing: the limiter attaches
 * itself through an `onRoute` hook that only exists once its plugin has
 * booted, and a route declared directly on the root is registered before that
 * happens, so its `config.rateLimit` is silently ignored.
 */
function withRoutes(
  define: (instance: FastifyInstance) => void
): FastifyInstance {
  const app = Fastify();
  registerRateLimiting(app);
  app.register(async (instance) => define(instance));
  return app;
}

async function buildApp(): Promise<Harness> {
  return start(
    withRoutes((instance) => {
      instance.post(
        "/limited",
        { preHandler: fakeAuth as any, config: rateLimited(TEST_POLICY) },
        async () => ({ ok: true })
      );

      instance.post("/unlimited", { preHandler: fakeAuth as any }, async () => ({
        ok: true,
      }));
    })
  );
}

describe("rate limiting", () => {
  it("lets the allowance through and rejects the request after it", async () => {
    const app = await buildApp();

    expect((await app.post("/limited", "alice")).status).toBe(200);
    expect((await app.post("/limited", "alice")).status).toBe(200);
    expect((await app.post("/limited", "alice")).status).toBe(429);

    await app.close();
  });

  it("answers 429 with a Retry-After the client can show as a wait", async () => {
    const app = await buildApp();

    await app.post("/limited", "alice");
    await app.post("/limited", "alice");
    const blocked = await app.post("/limited", "alice");

    expect(blocked.status).toBe(429);
    const retryAfter = blocked.headers.get("retry-after");
    expect(retryAfter).not.toBeNull();
    // Seconds remaining, not the whole window: a wait the user can act on.
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeLessThanOrEqual(60);

    await app.close();
  });

  it("shapes the 429 body like every other error in this API", async () => {
    const app = await buildApp();

    await app.post("/limited", "alice");
    await app.post("/limited", "alice");
    const blocked = await app.post("/limited", "alice");

    const body = (await blocked.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
    expect(body.error).toContain("Slow down");

    await app.close();
  });

  it("buckets per user — one heavy user does not lock everyone else out", async () => {
    const app = await buildApp();

    await app.post("/limited", "alice");
    await app.post("/limited", "alice");
    expect((await app.post("/limited", "alice")).status).toBe(429);

    // Bob has spent nothing.
    expect((await app.post("/limited", "bob")).status).toBe(200);

    await app.close();
  });

  it("counts the user, not the connection — the limiter runs after auth", async () => {
    const app = await buildApp();

    // Every request below comes from 127.0.0.1. If the limiter were keyed on
    // the address — which is what happens on the default `onRequest` hook,
    // before `userId` exists — the second user would already be blocked.
    await app.post("/limited", "alice");
    await app.post("/limited", "alice");
    await app.post("/limited", "bob");
    expect((await app.post("/limited", "bob")).status).toBe(200);

    await app.close();
  });

  it("leaves routes that did not ask to be limited alone", async () => {
    const app = await buildApp();

    for (let i = 0; i < 5; i++) {
      expect((await app.post("/unlimited", "alice")).status).toBe(200);
    }

    await app.close();
  });

  it("namespaces buckets by policy so two limits cannot share a counter", async () => {
    const other: RateLimitPolicy = { ...TEST_POLICY, name: "other" };
    const app = await start(
      withRoutes((instance) => {
        instance.post(
          "/a",
          { preHandler: fakeAuth as any, config: rateLimited(TEST_POLICY) },
          async () => ({ ok: true })
        );
        instance.post(
          "/b",
          { preHandler: fakeAuth as any, config: rateLimited(other) },
          async () => ({ ok: true })
        );
      })
    );

    await app.post("/a", "alice");
    await app.post("/a", "alice");
    expect((await app.post("/a", "alice")).status).toBe(429);
    expect((await app.post("/b", "alice")).status).toBe(200);

    await app.close();
  });

  it("does not reshape errors that are not rate limits", async () => {
    const app = await start(
      withRoutes((instance) => {
        instance.post("/boom", async () => {
          throw new Error("kaboom");
        });
      })
    );

    const response = await app.post("/boom", "alice");
    expect(response.status).toBe(500);
    // Fastify's own envelope, untouched.
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.statusCode).toBe(500);

    await app.close();
  });
});

describe("RATE_LIMITS.saves", () => {
  it("is the 100-a-day the spec fixes", () => {
    // docs/functional-spec/08-api-surface.md § Conventions.
    expect(RATE_LIMITS.saves.max).toBe(100);
    expect(RATE_LIMITS.saves.timeWindow).toBe("1 day");
  });

  it("names the wait in the message the user reads", () => {
    expect(RATE_LIMITS.saves.message("3 hours")).toContain("3 hours");
  });
});
