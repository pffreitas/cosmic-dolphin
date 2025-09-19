import {
  streamText,
  StreamTextResult,
  ToolSet,
  Tool as AITool,
  tool,
} from "ai";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { LanguageModelV2, ProviderV2 } from "@ai-sdk/provider";
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
} from "./types";
import { Tool } from "./tool";
import { ToolRegistry } from "./tool";
import { z, ZodSchema } from "zod";
import { Identifier } from "./id";
import { EventBus } from "./bus";
import { createOllama, OllamaProvider } from "ollama-ai-provider-v2";
import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai";
import { createAzure, AzureOpenAIProvider } from "@ai-sdk/azure";

export class AI {
  private openrouter: OpenRouterProvider;
  private ollama: OllamaProvider;
  private openai: OpenAIProvider;
  private azure: AzureOpenAIProvider;

  constructor(private eventBus: EventBus) {
    this.openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.azure = createAzure({
      resourceName: process.env.AZURE_RESOURCE_NAME,
      apiKey: process.env.AZURE_API_KEY,
    });

    this.openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    this.ollama = createOllama({
      baseURL: process.env.OLLAMA_URL,
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

  private getModel(modelId: string): LanguageModelV2 {
    if (modelId.startsWith("ollama:")) {
      return this.ollama(modelId.replace("ollama:", ""));
    }
    if (modelId.startsWith("openai:")) {
      return this.openai(modelId.replace("openai:", ""));
    }
    if (modelId.startsWith("azure:")) {
      return this.azure(modelId.replace("azure:", ""));
    }
    return this.openrouter(modelId);
  }

  async *prompt(input: PromptInput): AsyncGenerator<LLMResponsePart> {
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

    const result = streamText({
      model: this.getModel(input.modelId),
      messages: [...input.context, input.message],
      tools: aiTools,
      maxRetries: 3,
      stopWhen: async ({ steps }) => {
        if (steps.length >= 1000) {
          return true;
        }

        return false;
      },
    });

    yield* this.processStream(input, result);
  }

  async *processStream(
    input: PromptInput,
    stream: StreamTextResult<ToolSet, never>
  ): AsyncGenerator<LLMResponsePart> {
    const parts: LLMResponsePart[] = [];

    let currentText: LLMTextResponsePart | undefined;
    const toolcalls: Record<string, LLMToolResponsePart> = {};

    for await (const value of stream.fullStream) {
      console.log(value.type);

      switch (value.type) {
        case "start":
          break;
        case "start-step":
          console.log("start-step", value);
          break;
        case "finish-step":
          console.log("finish-step", value);
          const usagePart: LLMUsagePart = {
            sessionID: input.sessionID,
            taskID: input.taskID,
            messageID: input.messageID,
            partID: Identifier.ascending("part"),
            type: "usage",
            part: {
              inputTokens: value.usage.inputTokens,
              outputTokens: value.usage.outputTokens,
              totalTokens: value.usage.totalTokens,
              reasoningTokens: value.usage.reasoningTokens,
              cachedInputTokens: value.usage.cachedInputTokens,
            },
          };
          parts.push(usagePart);
          this.eventBus.publish("message.part.updated", usagePart);
          yield usagePart;
          break;
        case "reasoning-start":
          console.log("reasoning-start", value);
          break;
        case "reasoning-delta":
          console.log("reasoning-delta", value);
          break;
        case "reasoning-end":
          console.log("reasoning-end", value);
          break;
        case "tool-input-start":
          const part: LLMToolResponsePart = {
            sessionID: input.sessionID,
            taskID: input.taskID,
            messageID: input.messageID,
            partID: toolcalls[value.id]?.partID ?? Identifier.ascending("part"),
            type: "tool",
            part: {
              tool: value.toolName,
              callID: value.id,
              state: {
                status: "pending",
                input: "",
                output: "",
                metadata: {},
                title: "",
              },
              time: Date.now(),
            },
          };
          toolcalls[value.id] = part;
          this.eventBus.publish("message.part.updated", part);
          yield part;
          break;

        case "tool-input-delta":
          break;

        case "tool-input-end":
          break;

        case "tool-call": {
          const match = toolcalls[value.toolCallId];
          if (match) {
            const part: LLMToolResponsePart = {
              ...match,
              part: {
                tool: value.toolName,
                callID: value.toolCallId,
                state: {
                  status: "running",
                  input: value.input,
                  output: "",
                  metadata: {},
                  title: "",
                },
                time: Date.now(),
              },
            };
            toolcalls[value.toolCallId] = part as LLMToolResponsePart;
            this.eventBus.publish("message.part.updated", part);
            yield part;
          }
          break;
        }

        case "tool-result": {
          const match = toolcalls[value.toolCallId];
          if (match && match.part.state.status === "running") {
            const part: LLMToolResponsePart = {
              ...match,
              part: {
                tool: value.toolName,
                callID: value.toolCallId,
                state: {
                  status: "completed",
                  input: value.input,
                  output: value.output.output,
                  metadata: value.output.metadata,
                  title: value.output.title,
                },
                time: Date.now(),
              },
            };
            delete toolcalls[value.toolCallId];
            this.eventBus.publish("message.part.updated", part);
            yield part;
          }
          break;
        }

        case "tool-error": {
          const match = toolcalls[value.toolCallId];
          if (match && match.part.state.status === "running") {
            const part: LLMToolResponsePart = {
              ...match,
              part: {
                tool: value.toolName,
                callID: value.toolCallId,
                state: {
                  status: "error",
                  input: value.input,
                  output: (value.error as any).toString(),
                  metadata: {},
                  title: "",
                },
                time: Date.now(),
              },
            };
            delete toolcalls[value.toolCallId];
            this.eventBus.publish("tool.failed", part);
            yield part;
          }
          break;
        }

        case "error":
          throw value.error;

        case "text-start":
          currentText = {
            sessionID: input.sessionID,
            taskID: input.taskID,
            messageID: input.messageID,
            partID: Identifier.ascending("part"),
            type: "text",
            part: {
              text: "",
            },
          };
          break;

        case "text-delta":
          if (currentText) {
            currentText.part.text += value.text;
            this.eventBus.publish("message.part.updated", currentText);
            yield currentText;
          }
          break;

        case "text-end":
          if (currentText) {
            currentText.part.text = currentText.part.text.trimEnd();
            parts.push(currentText);
            this.eventBus.publish("message.part.updated", currentText);
            yield currentText;
          }
          currentText = undefined;
          break;

        case "finish":
          const usage: LLMUsagePart = {
            sessionID: input.sessionID,
            taskID: input.taskID,
            messageID: input.messageID,
            partID: Identifier.ascending("part"),
            type: "usage",
            part: {
              inputTokens: value.totalUsage.inputTokens,
              outputTokens: value.totalUsage.outputTokens,
              totalTokens: value.totalUsage.totalTokens,
              reasoningTokens: value.totalUsage.reasoningTokens,
              cachedInputTokens: value.totalUsage.cachedInputTokens,
            },
          };
        // this.eventBus.publish("message.part.updated", usage);
        // yield usage;

        // TODO: publish usage
        // this.eventBus.publish("session.updated", usage);
      }
    }
  }
}
