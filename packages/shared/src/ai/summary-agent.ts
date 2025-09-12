import { ModelMessage, streamText } from "ai";
import { Bookmark } from "../types";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateMetadataPrompt } from "./generate-metadata";

export namespace SummaryAgent {
  export async function generateSummary(bookmark: Bookmark) {
    const messages: ModelMessage[] = [];

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    messages.push({
      role: "user",
      content: generateMetadataPrompt.replace(
        "{{CONTENT}}",
        bookmark.content ?? ""
      ),
    });

    const result = streamText({
      model: openrouter("anthropic/claude-sonnet-4"),
      messages,
    });

    let fullResponse = "";
    for await (const delta of result.textStream) {
      fullResponse += delta;
      console.log(delta);
    }

    return fullResponse;
  }
}
