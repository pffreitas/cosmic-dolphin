import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { createDatabase } from "@cosmic-dolphin/shared";
import { QueueProcessor } from "./queue.processor";
import { QueueService } from "./queue.service";
import { BookmarkProcessorHandler } from "./handlers/bookmark-processor.handler";
import { BookmarkNotFoundError } from "@cosmic-dolphin/shared";

function configService(values: Record<string, string | undefined>) {
  return {
    get(key: string, fallback?: unknown) {
      return values[key] ?? fallback;
    },
  };
}

describe("queue configuration", () => {
  test("does not start when QUEUE_AUTO_START is the string false", async () => {
    const processor = new QueueProcessor(
      {} as never,
      configService({ QUEUE_AUTO_START: "false" }) as never,
      [],
    );
    let starts = 0;
    processor.startProcessing = async () => {
      starts += 1;
    };

    await processor.onModuleInit();

    expect(starts).toBe(0);
  });

  test("coerces numeric settings and removes empty queue names", () => {
    const processor = new QueueProcessor(
      {} as never,
      configService({
        QUEUE_NAMES: " default, bookmarks, digests, ",
        QUEUE_POLL_INTERVAL: "2500",
        QUEUE_MAX_RETRIES: "4",
        QUEUE_BATCH_SIZE: "8",
        QUEUE_CONCURRENCY: "3",
        QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT: "15000",
      }) as never,
      [],
    );

    const options = (
      processor as unknown as {
        getProcessorOptions(): {
          queues: Array<{
            name: string;
            pollInterval: number;
            maxRetries: number;
            batchSize: number;
          }>;
          concurrency: number;
          gracefulShutdownTimeout: number;
        };
      }
    ).getProcessorOptions();

    expect(options).toEqual({
      queues: [
        {
          name: "default",
          pollInterval: 2500,
          maxRetries: 4,
          batchSize: 8,
        },
        {
          name: "bookmarks",
          pollInterval: 2500,
          maxRetries: 4,
          batchSize: 8,
        },
        {
          name: "digests",
          pollInterval: 2500,
          maxRetries: 4,
          batchSize: 8,
        },
      ],
      concurrency: 3,
      gracefulShutdownTimeout: 15000,
    });
  });
});

describe("terminal message failures", () => {
  test("leaves transient extraction failures available for bounded pgmq retry", async () => {
    const queue = { deleteMessage: async () => undefined, archiveMessage: async () => undefined };
    const archive = spyOn(queue, "archiveMessage");
    const handler = { canHandle: () => true, handle: async () => { throw Object.assign(new Error("Public page blocked"), { shouldRetry: true }); } };
    const processor = new QueueProcessor(queue as never, configService({}) as never, [handler] as never);
    await (processor as any).processMessage({ msg_id: 44, read_ct: 1, message: { type: "bookmark_process", data: {} } }, { name: "bookmarks", maxRetries: 3 });
    expect(archive).not.toHaveBeenCalled();
  });

  test("resumes the bookmark timeline on redelivery", async () => {
    const service = { process: async () => undefined };
    const process = spyOn(service, "process");
    const handler = new BookmarkProcessorHandler(service as never);
    await handler.handle({ msg_id: 44, read_ct: 2, message: { type: "bookmark_process", data: { bookmarkId: "bookmark-1", userId: "user-1" } } } as never);
    expect(process).toHaveBeenCalledWith("bookmark-1", "user-1", { phase: undefined, resume: true });
  });

  test("archives a durably failed bookmark without queue redelivery", async () => {
    const queue = {
      deleteMessage: async () => undefined,
      archiveMessage: async () => undefined,
    };
    const archive = spyOn(queue, "archiveMessage");
    const handler = {
      canHandle: () => true,
      handle: async () => {
        throw Object.assign(new Error("HTTP 401: Unauthorized"), {
          shouldRetry: false,
        });
      },
    };
    const processor = new QueueProcessor(
      queue as never,
      configService({}) as never,
      [handler] as never,
    );

    await (processor as any).processMessage(
      {
        msg_id: 42,
        read_ct: 1,
        enqueued_at: new Date(),
        vt: new Date(),
        message: { type: "bookmark_process", data: {} },
      },
      { name: "bookmarks", pollInterval: 5000, maxRetries: 3, batchSize: 10 },
    );

    expect(archive).toHaveBeenCalledWith("bookmarks", 42);
  });

  test("uses pgmq read count to exhaust retries across worker restarts", async () => {
    const queue = {
      deleteMessage: async () => undefined,
      archiveMessage: async () => undefined,
    };
    const archive = spyOn(queue, "archiveMessage");
    const handler = {
      canHandle: () => true,
      handle: async () => {
        throw new Error("Bookmark not found");
      },
    };
    const processor = new QueueProcessor(
      queue as never,
      configService({}) as never,
      [handler] as never,
    );

    await (processor as any).processMessage(
      {
        msg_id: 43,
        read_ct: 4,
        enqueued_at: new Date(),
        vt: new Date(),
        message: { type: "bookmark_process", data: {} },
      },
      { name: "bookmarks", pollInterval: 5000, maxRetries: 3, batchSize: 10 },
    );

    expect(archive).toHaveBeenCalledWith("bookmarks", 43);
  });
});

describe("exhausted deliveries", () => {
  const config = { name: "bookmarks", pollInterval: 5000, maxRetries: 3, batchSize: 10 };
  const BOOKMARK_ID = "0b0e6c1a-3f4d-4e5a-8b6c-7d8e9f0a1b2c";
  const USER_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const message = (read_ct: number, payload: unknown = { type: "bookmark_process", data: { bookmarkId: BOOKMARK_ID, userId: USER_ID } }) =>
    ({ msg_id: 50, read_ct, enqueued_at: new Date(), vt: new Date(), message: payload }) as never;

  function setup() {
    const queue = { deleteMessage: async () => undefined, archiveMessage: async () => undefined };
    const processorService = {
      process: async () => undefined,
      failExhausted: async (..._args: unknown[]) => true,
    };
    const handler = new BookmarkProcessorHandler(processorService as never);
    const processor = new QueueProcessor(queue as never, configService({}) as never, [handler]);
    return {
      processor,
      archive: spyOn(queue, "archiveMessage"),
      del: spyOn(queue, "deleteMessage"),
      run: spyOn(processorService, "process"),
      exhausted: spyOn(processorService, "failExhausted"),
    };
  }

  test("exhausted delivery is failed and archived without running", async () => {
    const { processor, archive, run, exhausted } = setup();

    await (processor as any).processMessage(message(5), config);

    expect(run).not.toHaveBeenCalled();
    expect(exhausted).toHaveBeenCalledWith(
      BOOKMARK_ID,
      USER_ID,
      "Processing stopped after repeated worker failures",
    );
    expect(archive).toHaveBeenCalledWith("bookmarks", 50);
  });

  test("exhausted delivery with an unreadable payload is still archived", async () => {
    for (const payload of [null, {}, { type: "bookmark_process" }, { type: "bookmark_process", data: { bookmarkId: BOOKMARK_ID } }]) {
      const { processor, archive, exhausted } = setup();

      await (processor as any).processMessage(message(5, payload), config);

      expect(exhausted).not.toHaveBeenCalled();
      expect(archive).toHaveBeenCalledWith("bookmarks", 50);
    }
  });

  test("exhausted delivery with malformed identifiers is archived without failing anything", async () => {
    const bad = [
      { bookmarkId: "bookmark-1", userId: USER_ID },
      { bookmarkId: BOOKMARK_ID, userId: "user-1" },
      { bookmarkId: 42, userId: USER_ID },
      { bookmarkId: BOOKMARK_ID, userId: { id: USER_ID } },
      { bookmarkId: [BOOKMARK_ID], userId: USER_ID },
    ];
    for (const data of bad) {
      const { processor, archive, exhausted } = setup();

      await (processor as any).processMessage(message(5, { type: "bookmark_process", data }), config);

      expect(exhausted).not.toHaveBeenCalled();
      expect(archive).toHaveBeenCalledWith("bookmarks", 50);
    }
  });

  test("exhausted delivery for a missing bookmark is still archived", async () => {
    const { processor, archive, exhausted } = setup();
    exhausted.mockResolvedValueOnce(false);

    await (processor as any).processMessage(message(5), config);

    expect(archive).toHaveBeenCalledWith("bookmarks", 50);
  });

  test("a failure to record exhaustion keeps the message for redelivery, which then archives it", async () => {
    const { processor, archive, del, run, exhausted } = setup();
    exhausted.mockRejectedValueOnce(new Error("connection reset"));
    const handleError = spyOn(processor as any, "handleError");

    await (processor as any).processMessage(message(5), config);

    expect(archive).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();

    await (processor as any).processMessage(message(6), config);

    expect(exhausted).toHaveBeenCalledTimes(2);
    expect(archive).toHaveBeenCalledWith("bookmarks", 50);
    expect(run).not.toHaveBeenCalled();
  });

  test("the bookmark handler leaves an unreadable payload alone and propagates persistence failures", async () => {
    const processorService = {
      failExhausted: async (..._args: unknown[]) => {
        throw new Error("connection reset");
      },
    };
    const handler = new BookmarkProcessorHandler(processorService as never);

    await expect(handler.onExhausted(message(5, null))).resolves.toBeUndefined();
    await expect(handler.onExhausted(message(5))).rejects.toThrow("connection reset");
  });

  test("the final allowed delivery still runs", async () => {
    const { processor, run, exhausted, del } = setup();

    await (processor as any).processMessage(message(4), config);

    expect(run).toHaveBeenCalledTimes(1);
    expect(exhausted).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith("bookmarks", 50);
  });
});

describe("a bookmark that no longer exists", () => {
  const config = { name: "bookmarks", pollInterval: 5000, maxRetries: 3, batchSize: 10 };
  const message = { msg_id: 60, read_ct: 1, enqueued_at: new Date(), vt: new Date(), message: { type: "bookmark_process", data: { bookmarkId: "bookmark-1", userId: "user-1" } } } as never;

  function setup(failure: Error) {
    const queue = { deleteMessage: async () => undefined, archiveMessage: async () => undefined };
    const processorService = { process: async () => { throw failure; } };
    const handler = new BookmarkProcessorHandler(processorService as never);
    const processor = new QueueProcessor(queue as never, configService({}) as never, [handler]);
    return { processor, del: spyOn(queue, "deleteMessage"), archive: spyOn(queue, "archiveMessage") };
  }

  test("a deleted bookmark acknowledges the message", async () => {
    const { processor, del, archive } = setup(new BookmarkNotFoundError("bookmark-1"));
    const handleError = spyOn(processor as any, "handleError");

    await (processor as any).processMessage(message, config);

    expect(del).toHaveBeenCalledWith("bookmarks", 60);
    expect(archive).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  test("other errors still retry", async () => {
    const { processor, del, archive } = setup(new Error("Model unavailable"));

    await (processor as any).processMessage(message, config);

    expect(del).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
  });
});

describe("graceful shutdown", () => {
  test("stopProcessing leaves no pending timer once in-flight work settles", async () => {
    const processor = new QueueProcessor(
      {} as never,
      configService({}) as never,
      [],
    );
    (processor as any).isProcessing = true;
    (processor as any).processingPromises = [Promise.resolve()];

    const pending = new Set<unknown>();
    const realSet = globalThis.setTimeout;
    const realClear = globalThis.clearTimeout;
    globalThis.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => {
      const timer = realSet(fn, ms, ...rest);
      if (ms === 30000) pending.add(timer);
      return timer;
    }) as never;
    globalThis.clearTimeout = ((timer: never) => {
      pending.delete(timer);
      realClear(timer);
    }) as never;
    try {
      await processor.stopProcessing();
      expect(pending.size).toBe(0);
    } finally {
      for (const timer of pending) realClear(timer as never);
      globalThis.setTimeout = realSet;
      globalThis.clearTimeout = realClear;
    }
  });
});

describe("pgmq over the database connection", () => {
  const url =
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@127.0.0.1:5433/postgres";
  const db = createDatabase(url);
  const queue = new QueueService(db as never);
  // An existing local queue no other test writes to.
  const NAME = "notifications";

  beforeAll(async () => {
    for (const m of await queue.popMessages(NAME, 100)) {
      await queue.deleteMessage(NAME, m.msg_id);
    }
  });
  afterAll(async () => {
    await db.destroy();
  });

  test("sends a JSON object and reads it back as an object", async () => {
    const payload = {
      type: "digest_generate",
      data: { userId: "user-1" },
      metadata: { source: "scheduler" },
    };
    const id = await queue.sendMessage(NAME, payload);

    const [message] = await queue.popMessages(NAME, 10);

    expect(message.msg_id).toBe(id);
    expect(message.message).toEqual(payload);
    expect(message.read_ct).toBe(1);
    expect(message.enqueued_at).toBeInstanceOf(Date);
    expect(message.vt).toBeInstanceOf(Date);
    await queue.deleteMessage(NAME, id);
  });

  test("archives a message and setVisibility(0) makes one readable at once", async () => {
    const archived = await queue.sendMessage(NAME, { n: "archive" });
    await queue.archiveMessage(NAME, archived);
    expect(await queue.popMessages(NAME, 10)).toHaveLength(0);

    const hidden = await queue.sendMessage(NAME, { n: "vt" });
    expect(await queue.popMessages(NAME, 10)).toHaveLength(1);
    expect(await queue.popMessages(NAME, 10)).toHaveLength(0);
    await queue.setVisibility(NAME, hidden, 0);
    const [again] = await queue.popMessages(NAME, 10);
    expect(again.msg_id).toBe(hidden);
    expect(again.read_ct).toBe(2);
    await queue.deleteMessage(NAME, hidden);
  });
});
