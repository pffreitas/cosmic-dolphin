import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { EmbeddingModelV2 } from "@ai-sdk/provider";

export interface EmbeddingService {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

export class EmbeddingServiceImpl implements EmbeddingService {
  private model: EmbeddingModelV2<string>;

  constructor() {
    const provider = process.env.EMBEDDING_PROVIDER || "openrouter";
    const modelId =
      process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

    this.model = this.resolveModel(provider, modelId);
  }

  private resolveModel(
    provider: string,
    modelId: string
  ): EmbeddingModelV2<string> {
    switch (provider) {
      case "openai": {
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        return openai.embedding(modelId);
      }
      case "openrouter": {
        const openrouter = createOpenRouter({
          apiKey: process.env.OPENROUTER_API_KEY,
        });
        return openrouter.textEmbeddingModel(modelId);
      }
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
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
