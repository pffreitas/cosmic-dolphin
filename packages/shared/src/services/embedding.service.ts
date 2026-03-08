import { embed, embedMany } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { EmbeddingModelV2 } from "@ai-sdk/provider";

export interface EmbeddingService {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

export class EmbeddingServiceImpl implements EmbeddingService {
  private model: EmbeddingModelV2<string>;

  constructor() {
    const modelId =
      process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.model = openrouter.textEmbeddingModel(modelId);
  }

  async embedText(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.model,
      value: text,
    });
    return embedding;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const { embeddings } = await embedMany({
      model: this.model,
      values: texts,
    });
    return embeddings;
  }
}
