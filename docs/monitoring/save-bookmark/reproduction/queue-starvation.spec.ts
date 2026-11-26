// Standalone diagnostic: runs the real dispatcher with an in-memory queue and handler.
import { mock, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";

const source = process.env.STARVATION_PROCESSOR_PATH ?? resolve(import.meta.dir, "../../../../apps/worker/src/queue/queue.processor.ts");
const noopDecorator = () => () => {};
mock.module("@nestjs/common", () => ({ Inject: noopDecorator, Injectable: noopDecorator, Logger: class { log() {} warn() {} error() {} debug() {} } }));
mock.module("@nestjs/config", () => ({ ConfigService: class {} }));
mock.module(dirname(source) + "/queue.service.ts", () => ({ QueueService: class {} }));
const { QueueProcessor } = await import(source);

test("an empty default queue does not prevent handling a waiting bookmark", async () => {
  const reads: string[] = [], handled: number[] = [];
  const waiting = [{ msg_id: 1, read_ct: 1, enqueued_at: new Date(), vt: new Date(), message: { type: "bookmark_process", data: {} } }];
  const queue = {
    async popMessages(name: string, count: number) { reads.push(name); return name === "bookmarks" ? waiting.splice(0, count) : []; },
    async deleteMessage() {}, async archiveMessage() {}, async setVisibility() {},
  };
  const values: Record<string, string> = {
    QUEUE_NAMES: process.env.STARVATION_QUEUE_ORDER ?? "default,bookmarks",
    QUEUE_CONCURRENCY: "5", QUEUE_POLL_INTERVAL: "5", QUEUE_GRACEFUL_SHUTDOWN_TIMEOUT: "100",
  };
  const config = { get(name: string, fallback?: unknown) { return values[name] ?? fallback; } };
  const handler = { canHandle: () => true, async handle(message: { msg_id: number }) { handled.push(message.msg_id); } };
  const processor = new QueueProcessor(queue as never, config as never, [handler] as never);
  try {
    await processor.startProcessing();
    await Bun.sleep(50);
    console.log(JSON.stringify({ reads, handled, waiting: waiting.length }));
    expect(reads).toContain("bookmarks");
    expect(handled).toEqual([1]);
  } finally {
    await processor.stopProcessing();
  }
});
