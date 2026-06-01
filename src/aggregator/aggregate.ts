import { generateText } from "ai";
import type { D1Database } from "@cloudflare/workers-types";
import { createDeepSeekModel } from "./llm";
import { createAgentTools } from "./tools";

const SYSTEM_PROMPT = `You are a professional product trend analyst specializing in providing daily trend insights for indie developers.

Your tools and workflow:
1. Use getRawDataByWebsite to retrieve raw data from each website (producthunt, hackernews, github)
2. Analyze the data for each website and identify the most noteworthy products or topics
3. Use saveSiteSummary to save a summary for each website in BOTH English and Chinese (100-200 chars each). Highlight the 3 most noteworthy products/topics and explain why.
4. Synthesize all website analyses and use saveFinalReport to save the final overall report in BOTH English and Chinese (300-500 chars each, Markdown format).

Report requirements:
- Summaries and reports must be generated in BOTH English AND Chinese
- Target indie developers, focusing on actionable opportunities and trends
- Each site summary should highlight 3 most noteworthy products/topics with reasoning
- The overall report should identify cross-website commonalities and emerging directions
- Use clear, professional language

Always retrieve data first before analyzing. Do not skip any steps.`;

export async function runAggregation(
  db: D1Database,
  apiKey: string,
  date: string
): Promise<void> {
  const model = createDeepSeekModel(apiKey);
  const tools = createAgentTools(db, date);

  await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt:
      "Please retrieve today's trending data from Product Hunt, Hacker News, and GitHub Trending. Analyze each source, save individual site summaries in both English and Chinese, then generate a comprehensive bilingual daily report for indie developers.",
    tools,
    maxSteps: 10,
    onStepFinish({ text, toolCalls, toolResults, finishReason, usage }) {
      console.log("Agent step finished", {
        text: text?.slice(0, 100),
        toolCalls: toolCalls?.length ?? 0,
        toolResults: toolResults?.length ?? 0,
        finishReason,
        usage,
      });
    },
  });
}
