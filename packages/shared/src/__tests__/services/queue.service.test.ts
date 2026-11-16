import { describe, it, expect } from "@jest/globals";
import { QueueServiceImpl } from "../../services/queue.service";

function setup() {
  const sent: Array<{ queue: string; payload: unknown; delay?: number }> = [];
  const pgmq = {
    send: async (queue: string, payload: unknown, delay?: number) => {
      sent.push({ queue, payload, delay });
      return 1;
    },
  };
  return { sent, service: new QueueServiceImpl(pgmq as never) };
}

describe("QueueService", () => {
  it("sendBookmarkProcessingMessage keeps its payload", async () => {
    const { sent, service } = setup();
    await service.sendBookmarkProcessingMessage("b1", "u1");
    expect(sent).toEqual([
      {
        queue: "bookmarks",
        delay: 0,
        payload: {
          type: "bookmark_process",
          data: { bookmarkId: "b1", userId: "u1" },
          metadata: { source: "api", priority: "medium" },
        },
      },
    ]);

    await service.sendBookmarkProcessingMessage("b1", "u1", { phase: "summary" as never, resume: true });
    expect((sent[1].payload as any).data).toEqual({
      bookmarkId: "b1",
      userId: "u1",
      phase: "summary",
      resume: true,
    });
  });
});
