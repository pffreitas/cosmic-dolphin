import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const generateObject = jest.fn<any>();
const embed = jest.fn<any>();
const embedMany = jest.fn<any>();

jest.mock("ai", () => ({
  ...(jest.requireActual("ai") as object),
  generateObject: (...args: unknown[]) => generateObject(...args),
  embed: (...args: unknown[]) => embed(...args),
  embedMany: (...args: unknown[]) => embedMany(...args),
}));

import { z } from "zod";
import { AI } from "../../ai";
import { EmbeddingServiceImpl } from "../../services/embedding.service";

describe("abort signal reaches the AI SDK", () => {
  beforeEach(() => {
    generateObject.mockReset().mockResolvedValue({ object: { ok: true }, usage: {} });
    embed.mockReset().mockResolvedValue({ embedding: [1], usage: { tokens: 1 } });
    embedMany.mockReset().mockResolvedValue({ embeddings: [[1]], usage: { tokens: 1 } });
  });

  it("generateObjectWithUsage forwards it as abortSignal", async () => {
    const controller = new AbortController();
    await new AI().generateObjectWithUsage({
      sessionID: "s",
      modelId: "m",
      prompt: "p",
      schema: z.object({ ok: z.boolean() }),
      signal: controller.signal,
    });
    expect(((generateObject.mock.calls[0] as any[])[0]).abortSignal).toBe(controller.signal);
  });

  it("generateObject forwards it as abortSignal", async () => {
    const controller = new AbortController();
    await new AI().generateObject({
      sessionID: "s",
      modelId: "m",
      prompt: "p",
      schema: z.object({ ok: z.boolean() }),
      signal: controller.signal,
    });
    expect(((generateObject.mock.calls[0] as any[])[0]).abortSignal).toBe(controller.signal);
  });

  it("an embedding call receives the signal", async () => {
    const controller = new AbortController();
    const service = new EmbeddingServiceImpl();
    await service.embedTextWithUsage("a", { signal: controller.signal });
    await service.embedTextsWithUsage(["a"], { signal: controller.signal });
    expect(((embed.mock.calls[0] as any[])[0]).abortSignal).toBe(controller.signal);
    expect(((embedMany.mock.calls[0] as any[])[0]).abortSignal).toBe(controller.signal);
  });
});
