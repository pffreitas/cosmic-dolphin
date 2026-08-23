import { embed, embedMany } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { EmbeddingModelV2 } from "@ai-sdk/provider";
import { BookmarkProcessingUsage } from "../types";
import { toProcessingUsage } from "../ai/usage";

export interface EmbeddingResult {
  value: number[];
  usage?: BookmarkProcessingUsage;
  metadata?: Record<string, any>;
}

export interface EmbeddingsResult {
  value: number[][];
  usage?: BookmarkProcessingUsage;
  metadata?: Record<string, any>;
}

export interface EmbeddingService {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
  embedTextWithUsage(text: string): Promise<EmbeddingResult>;
  embedTextsWithUsage(texts: string[]): Promise<EmbeddingsResult>;
  getModelId(): string;
}

export class EmbeddingServiceImpl implements EmbeddingService {
  private model: EmbeddingModelV2<string>;
  private modelId: string;

  constructor() {
    this.modelId =
      process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.model = openrouter.textEmbeddingModel(this.modelId);
  }

  getModelId(): string {
    return this.modelId;
  }

  async embedText(text: string): Promise<number[]> {
    const result = await this.embedTextWithUsage(text);
    return result.value;
  }

  async embedTextWithUsage(text: string): Promise<EmbeddingResult> {
    const result = await embed({
      model: this.model,
      value: text,
    });

    const usage = toProcessingUsage(
      normalizeEmbeddingUsage((result as any).usage),
      (result as any).providerMetadata
    );

    return {
      value: result.embedding,
      usage,
      metadata: usage?.providerMetadata,
    };
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const result = await this.embedTextsWithUsage(texts);
    return result.value;
  }

  async embedTextsWithUsage(texts: string[]): Promise<EmbeddingsResult> {
    if (texts.length === 0) return { value: [] };

    const result = await embedMany({
      model: this.model,
      values: texts,
    });

    const usage = toProcessingUsage(
      normalizeEmbeddingUsage((result as any).usage),
      (result as any).providerMetadata
    );

    return {
      value: result.embeddings,
      usage,
      metadata: usage?.providerMetadata,
    };
  }
}

function normalizeEmbeddingUsage(usage: unknown): unknown {
  if (!usage || typeof usage !== "object") return usage;

  const raw = usage as Record<string, any>;
  const tokens = raw.tokens ?? raw.totalTokens;
  if (typeof tokens !== "number") return usage;

  return {
    ...raw,
    inputTokens: raw.inputTokens ?? tokens,
    totalTokens: raw.totalTokens ?? tokens,
  };
}
