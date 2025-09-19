import { Tool } from "./tool";

export interface Session {
  sessionID: string;
  refID: string;
}

export interface Task {
  sessionID: string;
  taskID: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  subTasks: Record<string, SubTask>;
}

export interface SubTask {
  taskID: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PromptInput {
  sessionID: string;
  taskID: string;
  messageID: string;
  modelId: string;
  context: Message[];
  tools: Tool.Info[];
  message: Message;
}

export interface LLMResponsePart {
  sessionID: string;
  taskID: string;
  messageID: string;
  partID: string;
  type: "text" | "tool" | "usage";
  part: any;
}

export interface LLMTextResponsePart extends LLMResponsePart {
  type: "text";
  part: {
    text: string;
  };
}

export interface LLMToolResponsePart extends LLMResponsePart {
  type: "tool";
  part: {
    tool: string;
    callID: string;
    state: {
      status: "pending" | "running" | "completed" | "error";
      input: string;
      output: string;
      metadata: Record<string, any>;
      title: string;
    };
    time: number;
  };
}

export interface LLMUsagePart extends LLMResponsePart {
  type: "usage";
  part: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
    reasoningTokens: number | undefined;
    cachedInputTokens: number | undefined;
  };
}

export interface LLMResponse {
  sessionID: string;
  taskID: string;
  messageID: string;
  parts: LLMResponsePart[];
}
