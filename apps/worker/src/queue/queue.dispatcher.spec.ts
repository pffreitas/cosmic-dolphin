import { describe, expect, test } from "bun:test";
import { QueueProcessor } from "./queue.processor";

function configService(values: Record<string, string | undefined>) {
  return {
    get(key: string, fallback?: unknown) {
      return values[key] ?? fallback;
    },
  };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function msg(id: number, read_ct = 1) {
  return {
    msg_id: id,
    read_ct,
    enqueued_at: new Date(),
    vt: new Date(),
    message: { type: "bookmark_process", data: {} },
  };
}

/** A fake queue that hands out waiting messages and records every call. */
function fakeQueue(waiting: ReturnType<typeof msg>[]) {
  const calls: string[] = [];
  const reads: number[] = [];
  return {
    calls,
    reads,
    waiting,
    async popMessages(_name: string, count: number) {
      reads.push(count);
      return waiting.splice(0, count);
    },
    async deleteMessage(_n: string, id: number) {
      calls.push(`delete:${id}`);
    },
    async archiveMessage(_n: string, id: number) {
      calls.push(`archive:${id}`);
    },
    async setVisibility(_n: string, id: number, seconds: number) {
      calls.push(`vis:${id}:${seconds}`);
    },
  };
}

const config = { name: "bookmarks", pollInterval: 1000, maxRetries: 3, batchSize: 10 };

function build(queue: unknown, handle: (m: any, ctx: any) => Promise<void>, values = {}) {
  const handler = {
    canHandle: () => true,
    handle,
    getMessageType: () => "bookmark",
  };
  return new QueueProcessor(
    queue as never,
    configService({ QUEUE_NAMES: "bookmarks", QUEUE_CONCURRENCY: "5", ...values }) as never,
    [handler] as never,
  );
}

describe("dispatcher", () => {
  test("reads only as many messages as free slots", async () => {
    const queue = fakeQueue(Array.from({ length: 20 }, (_, i) => msg(i + 1)));
    const gates = new Map<number, ReturnType<typeof deferred>>();
    let running = 0;
    let peak = 0;
    const processor = build(queue, async (m) => {
      running += 1;
      peak = Math.max(peak, running);
      const gate = deferred();
      gates.set(m.msg_id, gate);
      await gate.promise;
      running -= 1;
    });

    await processor.startProcessing();
    await tick();

    expect(queue.reads).toEqual([5]);
    expect(running).toBe(5);
    await tick();
    expect(queue.reads).toEqual([5]); // no read while every slot is busy
    expect(peak).toBe(5);

    gates.get(1)!.resolve();
    await tick();
    await tick();
    expect(queue.reads).toEqual([5, 1]);
    expect(running).toBe(5);
    expect(peak).toBe(5);

    for (const gate of gates.values()) gate.resolve();
    await processor.stopProcessing();
  });

  test("starts a new message when a slot frees", async () => {
    const queue = fakeQueue([1, 2, 3].map((i) => msg(i)));
    const started: number[] = [];
    const gates = new Map<number, ReturnType<typeof deferred>>();
    const processor = build(
      queue,
      async (m) => {
        started.push(m.msg_id);
        const gate = deferred();
        gates.set(m.msg_id, gate);
        await gate.promise;
      },
      { QUEUE_CONCURRENCY: "2" },
    );

    await processor.startProcessing();
    await tick();
    expect(started).toEqual([1, 2]);

    gates.get(2)!.resolve();
    await tick();
    await tick();
    expect(started).toEqual([1, 2, 3]);
    expect(queue.calls).toContain("delete:2");

    for (const gate of gates.values()) gate.resolve();
    await processor.stopProcessing();
  });

  test("an idle queue polls every second by default", () => {
    const processor = build(fakeQueue([]), async () => undefined);
    const options = (processor as any).getProcessorOptions();
    expect(options.queues[0].pollInterval).toBe(1000);
  });
});

describe("dispositions", () => {
  function setup(handle: (m: any, ctx: any) => Promise<void>) {
    const queue = fakeQueue([]);
    return { queue, processor: build(queue, handle) };
  }
  const run = (p: QueueProcessor, m: ReturnType<typeof msg>) => (p as any).processMessage(m, config);

  test("success deletes", async () => {
    const { queue, processor } = setup(async () => undefined);
    await run(processor, msg(1));
    expect(queue.calls).toEqual(["delete:1"]);
  });

  test("an acknowledged message (handler returns) is deleted", async () => {
    const { queue, processor } = setup(async () => undefined);
    await run(processor, msg(2, 2));
    expect(queue.calls).toEqual(["delete:2"]);
  });

  test("a terminal failure archives", async () => {
    const { queue, processor } = setup(async () => {
      throw Object.assign(new Error("nope"), { shouldRetry: false });
    });
    await run(processor, msg(3));
    expect(queue.calls).toEqual(["archive:3"]);
  });

  test("backoff by delivery count", async () => {
    const { queue, processor } = setup(async () => {
      throw Object.assign(new Error("later"), { shouldRetry: true });
    });
    await run(processor, msg(4, 1));
    await run(processor, msg(4, 2));
    await run(processor, msg(4, 3));
    expect(queue.calls).toEqual(["vis:4:30", "vis:4:120", "vis:4:600"]);
  });

  test("a retryable failure on the final attempt archives", async () => {
    const { queue, processor } = setup(async () => {
      throw Object.assign(new Error("last"), { shouldRetry: true });
    });
    await run(processor, msg(5, 4));
    expect(queue.calls).toEqual(["archive:5"]);
  });

  test("the handler is told when this is the final attempt", async () => {
    const seen: boolean[] = [];
    const { processor } = setup(async (_m, ctx) => {
      seen.push(ctx.finalAttempt);
    });
    for (const ct of [1, 3, 4]) await run(processor, msg(6, ct));
    expect(seen).toEqual([false, false, true]);
  });
});

describe("shutdown", () => {
  test("shutdown returns unfinished messages to the queue", async () => {
    const queue = fakeQueue([msg(1), msg(2), msg(3)]);
    const gates: ReturnType<typeof deferred>[] = [];
    const processor = build(
      queue,
      async (m) => {
        const gate = deferred();
        gates.push(gate);
        if (m.msg_id === 1) {
          gate.resolve();
        }
        await gate.promise;
      },
      { QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT: "20" },
    );

    await processor.startProcessing();
    await tick();
    await tick();
    expect(queue.calls).toEqual(["delete:1"]);

    await processor.stopProcessing();

    expect(queue.calls.slice(1).sort()).toEqual(["vis:2:0", "vis:3:0"]);
    // reading stopped
    const readsAfter = queue.reads.length;
    await tick();
    expect(queue.reads.length).toBe(readsAfter);

    // a handler that finishes late does not override the release
    for (const gate of gates) gate.resolve();
    await tick();
    expect(queue.calls.filter((c) => c.startsWith("delete:2") || c.startsWith("vis:2:3"))).toEqual([]);
  });
});
