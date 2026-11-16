import { describe, expect, spyOn, test } from "bun:test";
import { QueueProcessor } from "./queue.processor";
import { QueueService } from "./queue.service";
import { SupabaseClientService } from "./supabase-client.service";
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
    const handler = new BookmarkProcessorHandler(service as never, {} as never);
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
  const message = (read_ct: number, payload: unknown = { type: "bookmark_process", data: { bookmarkId: "bookmark-1", userId: "user-1" } }) =>
    ({ msg_id: 50, read_ct, enqueued_at: new Date(), vt: new Date(), message: payload }) as never;

  function setup() {
    const queue = { deleteMessage: async () => undefined, archiveMessage: async () => undefined };
    const bookmarkService = { updateProcessingStatus: async () => ({}) };
    const processorService = { process: async () => undefined };
    const handler = new BookmarkProcessorHandler(processorService as never, bookmarkService as never);
    const processor = new QueueProcessor(queue as never, configService({}) as never, [handler]);
    return {
      processor,
      archive: spyOn(queue, "archiveMessage"),
      del: spyOn(queue, "deleteMessage"),
      run: spyOn(processorService, "process"),
      status: spyOn(bookmarkService, "updateProcessingStatus"),
    };
  }

  test("exhausted delivery is failed and archived without running", async () => {
    const { processor, archive, run, status } = setup();

    await (processor as any).processMessage(message(5), config);

    expect(run).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(
      "bookmark-1",
      "failed",
      "Processing stopped after repeated worker failures",
    );
    expect(archive).toHaveBeenCalledWith("bookmarks", 50);
  });

  test("exhausted delivery with an unreadable payload is still archived", async () => {
    for (const payload of [null, {}, { type: "bookmark_process" }]) {
      const { processor, archive, status } = setup();

      await (processor as any).processMessage(message(5, payload), config);

      expect(status).not.toHaveBeenCalled();
      expect(archive).toHaveBeenCalledWith("bookmarks", 50);
    }
  });

  test("exhausted delivery for a deleted bookmark is still archived", async () => {
    const { processor, archive, status } = setup();
    status.mockRejectedValueOnce(new Error("Bookmark not found"));

    await (processor as any).processMessage(message(5), config);

    expect(archive).toHaveBeenCalledWith("bookmarks", 50);
  });

  test("the bookmark handler tolerates an unreadable payload or a missing bookmark", async () => {
    const bookmarkService = {
      updateProcessingStatus: async () => {
        throw new Error("Bookmark not found");
      },
    };
    const handler = new BookmarkProcessorHandler({} as never, bookmarkService as never);

    await expect(handler.onExhausted(message(5, null))).resolves.toBeUndefined();
    await expect(handler.onExhausted(message(5))).resolves.toBeUndefined();
  });

  test("the final allowed delivery still runs", async () => {
    const { processor, run, status, del } = setup();

    await (processor as any).processMessage(message(4), config);

    expect(run).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith("bookmarks", 50);
  });
});

describe("a bookmark that no longer exists", () => {
  const config = { name: "bookmarks", pollInterval: 5000, maxRetries: 3, batchSize: 10 };
  const message = { msg_id: 60, read_ct: 1, enqueued_at: new Date(), vt: new Date(), message: { type: "bookmark_process", data: { bookmarkId: "bookmark-1", userId: "user-1" } } } as never;

  function setup(failure: Error) {
    const queue = { deleteMessage: async () => undefined, archiveMessage: async () => undefined };
    const processorService = { process: async () => { throw failure; } };
    const handler = new BookmarkProcessorHandler(processorService as never, {} as never);
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

describe("pgmq RPC contracts", () => {
  test("archives with the deployed message_id argument", async () => {
    const supabase = {
      getClient: () => ({
        schema: (schemaName: string) => ({
          rpc: async (functionName: string, args: Record<string, unknown>) => ({
            data: null,
            error:
              schemaName === "pgmq_public" &&
              functionName === "archive" &&
              args.queue_name === "bookmarks" &&
              args.message_id === 42 &&
              !("msg_id" in args)
                ? null
                : { message: "RPC signature mismatch" },
          }),
        }),
      }),
    };
    const queue = new QueueService(supabase as never);

    await expect(
      queue.archiveMessage("bookmarks", 42),
    ).resolves.toBeUndefined();
  });

  test("sends a JSON object rather than a stringified payload", async () => {
    const payload = {
      type: "digest_generate",
      data: { userId: "user-1" },
      metadata: { source: "scheduler" },
    };
    const supabase = {
      getClient: () => ({
        schema: () => ({
          rpc: async (functionName: string, args: Record<string, unknown>) => ({
            data: 7,
            error:
              functionName === "send" && args.message === payload
                ? null
                : { message: "Payload was not passed as JSON" },
          }),
        }),
      }),
    };
    const queue = new QueueService(supabase as never);

    await expect(queue.sendMessage("digests", payload)).resolves.toBe(7);
  });

  test("connection check uses a non-mutating read against an existing queue", async () => {
    const client = {
      schema: () => ({
        rpc: async (functionName: string, args: Record<string, unknown>) => ({
          data: [],
          error:
            functionName === "read" &&
            args.queue_name === "bookmarks" &&
            args.sleep_seconds === 0 &&
            args.n === 0
              ? null
              : { message: "Unexpected connection probe" },
        }),
      }),
    };
    const service = Object.create(
      SupabaseClientService.prototype,
    ) as SupabaseClientService;
    const internals = service as unknown as {
      client: typeof client;
      logger: { log(): void; error(): void };
    };
    internals.client = client;
    internals.logger = { log() {}, error() {} };

    await expect(service.testConnection()).resolves.toBe(true);
  });
});
