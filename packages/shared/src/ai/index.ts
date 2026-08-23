import {
  streamText,
  StreamTextResult,
  ToolSet,
  Tool as AITool,
  tool,
  generateObject,
} from "ai";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { LanguageModelV2 } from "@ai-sdk/provider";
import {
  LLMResponse,
  LLMResponsePart,
  LLMTextResponsePart,
  LLMToolResponsePart,
  LLMUsagePart,
  PromptInput,
  Session,
  SubTask,
  Task,
  GenerateObjectInput,
} from "./types";
import { Tool } from "./tool";
import { ToolRegistry } from "./tool";
import { z, ZodSchema } from "zod";
import { Identifier } from "./id";
import { BookmarkProcessingUsage } from "../types";
import { toProcessingUsage } from "./usage";

export interface AITextResult {
  value: string;
  text: string;
  usage?: BookmarkProcessingUsage;
  providerMetadata?: Record<string, any>;
}

export interface AIObjectResult<T> {
  value: T;
  usage?: BookmarkProcessingUsage;
  providerMetadata?: Record<string, any>;
}

export class AI {
  private openrouter: OpenRouterProvider;

  constructor() {
    this.openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  async newSession(refID: string): Promise<Session> {
    return {
      sessionID: Identifier.ascending("session"),
      refID,
    };
  }

  async newTask(sessionID: string, name: string): Promise<Task> {
    return {
      sessionID,
      taskID: Identifier.ascending("task"),
      name,
      status: "pending",
      subTasks: {},
    };
  }

  async newSubTask(name: string): Promise<SubTask> {
    return {
      taskID: Identifier.ascending("subtask"),
      name,
      status: "pending",
    };
  }

  getModel(modelId: string): LanguageModelV2 {
    return this.openrouter(modelId);
  }

  async generateObjectWithUsage<T>(
    input: GenerateObjectInput<T>
  ): Promise<AIObjectResult<T>> {
    const result = await generateObject({
      model: this.getModel(input.modelId),
      schema: input.schema,
      prompt: input.prompt,
    });

    const usage = toProcessingUsage(
      (result as any).usage ?? (result as any).totalUsage,
      (result as any).providerMetadata
    );

    return {
      value: result.object,
      usage,
      providerMetadata: usage?.providerMetadata,
    };
  }

  async generateObject<T>(input: GenerateObjectInput<T>): Promise<T> {
    const result = await this.generateObjectWithUsage(input);
    return result.value;
  }

  async generateText(input: PromptInput): Promise<AITextResult> {
    const aiTools = await this.buildTools(input);
    const result = streamText({
      model: this.getModel(input.modelId),
      messages: [...input.context, input.message],
      tools: aiTools,
      maxRetries: 3,
      stopWhen: async ({ steps }) => steps.length >= 1000,
    });

    return this.processStream(input, result);
  }

  async *prompt(input: PromptInput): AsyncGenerator<LLMResponsePart> {
    const result = await this.generateText(input);
    yield {
      sessionID: input.sessionID,
      taskID: input.taskID,
      messageID: input.messageID,
      partID: Identifier.ascending("part"),
      type: "text",
      part: { text: result.text },
    };
    if (result.usage) {
      yield {
        sessionID: input.sessionID,
        taskID: input.taskID,
        messageID: input.messageID,
        partID: Identifier.ascending("part"),
        type: "usage",
        part: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          reasoningTokens: result.usage.reasoningTokens,
          cachedInputTokens: result.usage.cachedInputTokens,
        },
      };
    }
  }

  async processStream(
    input: PromptInput,
    stream: StreamTextResult<ToolSet, never>
  ): Promise<AITextResult> {
    let text = "";
    let rawUsage: unknown;
    let providerMetadata: unknown;

    for await (const value of stream.fullStream) {
      switch (value.type) {
        case "start":
          break;
        case "start-step":
          break;
        case "finish-step":
          rawUsage = value.usage;
          providerMetadata = (value as any).providerMetadata;
          break;
        case "reasoning-start":
          break;
        case "reasoning-delta":
          break;
        case "reasoning-end":
          break;
        case "tool-input-start":
          break;

        case "tool-input-delta":
          break;

        case "tool-input-end":
          break;

        case "tool-call": {
          break;
        }

        case "tool-result": {
          break;
        }

        case "tool-error": {
          break;
        }

        case "error":
          throw value.error;

        case "text-start":
          break;

        case "text-delta":
          text += value.text;
          break;

        case "text-end":
          break;

        case "finish":
          rawUsage = value.totalUsage;
          providerMetadata = (value as any).providerMetadata ?? providerMetadata;
      }
    }

    const usage = toProcessingUsage(rawUsage, providerMetadata);
    return {
      value: text.trimEnd(),
      text: text.trimEnd(),
      usage,
      providerMetadata: usage?.providerMetadata,
    };
  }

  private async buildTools(input: PromptInput): Promise<Record<string, AITool>> {
    const aiTools: Record<string, AITool> = {};
    for (const item of await ToolRegistry.init(input.tools)) {
      aiTools[item.id] = tool({
        id: item.id as any,
        description: item.description,
        inputSchema: item.parameters as ZodSchema,
        async execute(args, options) {
          return await item.execute(args, {
            sessionID: input.sessionID,
            messageID: input.messageID,
            agent: "1",
            abort: options.abortSignal!,
            extra: {},
            metadata: () => {},
          });
        },
      });
    }

    return aiTools;
  }
}
