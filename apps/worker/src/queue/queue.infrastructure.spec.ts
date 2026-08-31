import { describe, expect, test } from "bun:test";
import { QueueProcessor } from "./queue.processor";
import { QueueService } from "./queue.service";
import { SupabaseClientService } from "./supabase-client.service";

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
