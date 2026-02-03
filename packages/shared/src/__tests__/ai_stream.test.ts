import { AI } from "../ai";
import { EventBus } from "../ai/bus";
import { PromptInput } from "../ai/types";
import { Identifier } from "../ai/id";
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

// Mock dependencies
jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: jest.fn(() => jest.fn()),
}));
jest.mock("@ai-sdk/azure", () => ({
  createAzure: jest.fn(() => jest.fn()),
}));
jest.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: jest.fn(() => jest.fn()),
}));
jest.mock("ollama-ai-provider-v2", () => ({
  createOllama: jest.fn(() => jest.fn()),
}));

// Mock Identifier
jest.mock("../ai/id", () => ({
  Identifier: {
    ascending: jest.fn(() => "mock-part-id"),
  },
}));

describe("AI Stream", () => {
  let mockEventBus: EventBus;

  beforeAll(() => {
    mockEventBus = {
      publish: jest.fn(),
    } as unknown as EventBus;
  });

  it("should publish usage stats on stream finish", async () => {
    const ai = new AI(mockEventBus);

    const input: PromptInput = {
      sessionID: "session-1",
      taskID: "task-1",
      messageID: "message-1",
      modelId: "openai:gpt-4",
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

    // Consume the generator
    const parts = [];
    for await (const part of generator) {
        parts.push(part);
    }

    // Check if publish was called with message.part.updated and usage type
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
