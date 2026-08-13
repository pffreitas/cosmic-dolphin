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

describe("AI Stream", () => {
  beforeAll(() => {});

  it("should collect streamed text and usage without publishing realtime events", async () => {
    const ai = new AI();

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
          type: "text-start",
        };
        yield {
          type: "text-delta",
          text: "Hello ",
        };
        yield {
          type: "text-delta",
          text: "world",
        };
        yield {
          type: "finish",
          totalUsage: mockUsage,
        };
      })(),
    } as any;

    const result = await ai.processStream(input, stream);

    expect(result.text).toBe("Hello world");
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      reasoningTokens: 5,
      cachedInputTokens: 0,
      costUsd: undefined,
      providerMetadata: undefined,
    });
  });
});
