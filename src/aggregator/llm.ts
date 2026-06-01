// DeepSeek LLM provider setup via AI SDK

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export function createDeepSeekModel(apiKey: string): LanguageModelV1 {
  const provider = createOpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey,
  });

  return provider("deepseek-chat");
}
