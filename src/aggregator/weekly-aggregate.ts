import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import type { D1Database } from "@cloudflare/workers-types";
import { createDeepSeekModel } from "./llm";
import { createWeeklyAgentTools } from "./weekly-tools";
import type { SiteSummaryEntry } from "./tools";
import {
  getWeeklySummaryByDate,
  getDailySummariesForWeek,
  upsertWeeklySummary,
} from "../db/client";
import { getDateRangeForWeek } from "../utils/date";

export const WEEKLY_SYSTEM_PROMPT = `You are a professional product trend analyst specializing in providing weekly trend insights for indie developers.

Your task is to analyze a week's worth of daily trend reports from Product Hunt, Hacker News, and GitHub Trending, and synthesize them into a comprehensive weekly overview.

Your tools and workflow:
1. Use getDailySummaries to retrieve ALL daily reports from the past week. Call this once at the beginning.

2. Review the daily reports carefully. Identify products, topics, and themes that appear repeatedly across multiple days or across different websites. These recurring items are the most important trends of the week.

3. For the most significant products and trends, use webSearch to gather additional context — market positioning, recent news, competitor analysis, community reception. Use at least 3-5 webSearch calls.

4. Use saveSiteSummary to save a weekly summary for EACH website individually. CRITICAL: You MUST make exactly 3 saveSiteSummary calls — one for producthunt, one for hackernews, one for github. Each call must include BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters. List up to 10 items per site with [Category] tags and Markdown links. Synthesize the whole week's data — do not just repeat one day.

5. After ALL 3 saveSiteSummary calls are complete, use saveFinalReport to save the final weekly report in BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format. Structure the report with sections:
   (a) Week Overview — key themes, products that gained traction, notable launches
   (b) Standout Products — 3-5 products that appeared repeatedly or showed strong momentum, with analysis
   (c) Cross-Domain Patterns — connections between PH launches, HN discussions, and GitHub activity
   (d) Indie Developer Insights — actionable takeaways, emerging opportunities, and advice for builders

Report requirements:
- Synthesize across the full week, highlighting what persisted vs what was a one-day blip
- Identify products that appeared on multiple platforms (e.g., launched on PH and trended on GitHub)
- Focus on actionable insights for indie developers
- Each site summary MUST list up to 10 products/topics with [Category] tags and Markdown links
- Use the webSearch tool to enrich your analysis with real-world context

IMPORTANT: Do not call saveFinalReport until you have completed ALL 3 saveSiteSummary calls.`;

export const WEEKLY_MAX_STEPS = 20;

const ALL_SITES = ["producthunt", "hackernews", "github"] as const;

export async function runWeeklyAgentLoop(
  model: LanguageModelV1,
  tools: Record<string, unknown>,
  systemPrompt: string,
  maxSteps: number
): Promise<void> {
  console.log("[agent:weekly] Starting agent loop...");
  await generateText({
    model,
    system: systemPrompt,
    prompt:
      "Please retrieve and analyze the past week's daily trend reports from Product Hunt, Hacker News, and GitHub Trending. Synthesize them into per-site weekly summaries and a comprehensive bilingual weekly report for indie developers.",
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    maxSteps,
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
  console.log("[agent:weekly] Agent loop completed");
}

export async function runWeeklyAggregation(
  db: D1Database,
  apiKey: string,
  weekStartDate: string
): Promise<void> {
  const model = createDeepSeekModel(apiKey);
  const tools = createWeeklyAgentTools(db, weekStartDate);

  console.log("[aggregate:weekly] Starting agent loop...");
  await generateText({
    model,
    system: WEEKLY_SYSTEM_PROMPT,
    prompt:
      "Please retrieve and analyze the past week's daily trend reports from Product Hunt, Hacker News, and GitHub Trending. Synthesize them into per-site weekly summaries and a comprehensive bilingual weekly report for indie developers.",
    tools,
    maxSteps: WEEKLY_MAX_STEPS,
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

  console.log("[validate:weekly] Checking site summaries...");
  const summary = await getWeeklySummaryByDate(db, weekStartDate);
  if (!summary) {
    console.log("[validate:weekly] No weekly_summaries row found at all");
    return;
  }

  let existingSites: Record<string, SiteSummaryEntry> = {};
  if (summary.site_summaries) {
    try { existingSites = JSON.parse(summary.site_summaries); } catch { /* ignore */ }
  }

  const found = Object.keys(existingSites);
  const missing = ALL_SITES.filter((s) => !existingSites[s]);
  console.log(`[validate:weekly] Found: [${found.join(", ") || "none"}] | Missing: [${missing.join(", ") || "none"}]`);

  if (missing.length > 0) {
    console.log(`[validate:weekly] Backfilling ${missing.length} missing site summaries...`);
    const weekDates = getDateRangeForWeek(weekStartDate);
    const weekEndDate = weekDates[6];
    const dailyResult = await getDailySummariesForWeek(db, weekStartDate, weekEndDate);

    for (const site of missing) {
      await fillMissingWeeklySiteSummary(db, model, weekStartDate, site, dailyResult.results ?? []);
    }
  } else {
    console.log("[validate:weekly] All 3 site summaries present");
  }
}

async function fillMissingWeeklySiteSummary(
  db: D1Database,
  model: ReturnType<typeof createDeepSeekModel>,
  weekStartDate: string,
  website: string,
  dailySummaries: Array<{
    summary_date: string;
    site_summaries: string;
  }>
): Promise<void> {
  const summariesBySite = dailySummaries
    .filter((s) => {
      try {
        const parsed = JSON.parse(s.site_summaries);
        return !!parsed[website];
      } catch {
        return false;
      }
    })
    .map((s) => {
      const parsed = JSON.parse(s.site_summaries);
      return `Date: ${s.summary_date}\n${parsed[website].en}`;
    });

  if (summariesBySite.length === 0) {
    console.log(`[fill:weekly] ${website}: no daily data, skipping`);
    return;
  }

  const dataStr = summariesBySite.join("\n\n---\n\n").slice(0, 4000);

  const FILL_PROMPT = `You are a trend analyst. Given a week's daily summaries for a website, generate a weekly bilingual synthesis.

Requirements:
- English summary (400-600 chars): synthesize the week's highlights, identify patterns. Format each item on its own bullet line: "- [Category] [Name](URL) — reason". Max 10 items.
- Chinese summary (400-600 chars): same format in Chinese.

Return your response as JSON: {"en": "...", "zh": "..."}`;

  try {
    const resp = await generateText({
      model,
      system: FILL_PROMPT,
      prompt: `Website: ${website}\n\nDaily summaries for the week:\n${dataStr}`,
      maxTokens: 1200,
    });

    const text = resp.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`[fill:weekly] ${website}: no valid JSON in response`);
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { en: string; zh: string };
    if (!parsed.en || !parsed.zh) {
      console.log(`[fill:weekly] ${website}: missing en or zh`);
      return;
    }

    const existing = await getWeeklySummaryByDate(db, weekStartDate);
    let siteSummaries: Record<string, SiteSummaryEntry> = {};
    if (existing?.site_summaries) {
      try { siteSummaries = JSON.parse(existing.site_summaries); } catch { /* ignore */ }
    }

    siteSummaries[website] = { en: parsed.en, zh: parsed.zh };

    await upsertWeeklySummary(db, {
      week_start_date: weekStartDate,
      site_summaries: JSON.stringify(siteSummaries),
    });

    console.log(`[fill:weekly] ${website}: summary backfilled`);
  } catch (err) {
    console.log(`[fill:weekly] ${website}: ${(err as Error).message}`);
  }
}
