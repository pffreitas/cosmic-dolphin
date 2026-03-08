import { describe, it, expect, beforeAll, mock } from "bun:test";
import { PromptInput } from "../ai/types";

mock.module("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: mock(() => mock()),
}));

mock.module("../ai/id", () => ({
  Identifier: {
    ascending: mock(() => "mock-part-id"),
  },
}));

import { AI } from "../ai";
import { EventBus } from "../ai/bus";

describe("AI Stream", () => {
  let mockEventBus: EventBus;

  beforeAll(() => {
    mockEventBus = {
      publish: mock(),
    } as unknown as EventBus;
  });

  it("should publish usage stats on stream finish", async () => {
    const ai = new AI(mockEventBus);

    const input: PromptInput = {
      sessionID: "session-1",
      taskID: "task-1",
      messageID: "message-1",
      modelId: "openai/gpt-4",
      context: [],
      tools: [],
      message: { role: "user", content: "hello" },
    };

    const mockUsage = {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      reasoningTokens: 5,
      cachedInputTokens: 0,
    };

    const stream = {
      fullStream: (async function* () {
        yield {
          type: "finish",
          totalUsage: mockUsage,
        };
      })(),
    } as any;

    const generator = ai.processStream(input, stream);

    const parts = [];
    for await (const part of generator) {
      parts.push(part);
    }

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      "message.part.updated",
      expect.objectContaining({
        type: "usage",
        part: mockUsage,
        sessionID: input.sessionID,
        taskID: input.taskID,
        messageID: input.messageID,
        partID: "mock-part-id",
      })
    );
  });
});
