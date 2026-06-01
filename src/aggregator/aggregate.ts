import { generateText } from "ai";
import type { D1Database } from "@cloudflare/workers-types";
import { createDeepSeekModel } from "./llm";
import { createAgentTools, type SiteSummaryEntry } from "./tools";
import {
  getSummaryByDate,
  getCompletedTasksByDateAndWebsite,
  upsertDailySummary,
} from "../db/client";

const SYSTEM_PROMPT = `You are a professional product trend analyst specializing in providing daily trend insights for indie developers.

Your tools and workflow:
1. Use getRawDataByWebsite to retrieve raw data from ALL three websites: producthunt, hackernews, github. You MUST call it 3 times.

2. Analyze the data for each website and identify the 3 most noteworthy products or topics. When mentioning specific products, articles, or repos, ALWAYS use Markdown link format [Name](URL) using the URL/links from the raw data.

3. Use saveSiteSummary to save a summary for EACH website individually. CRITICAL: You MUST make exactly 3 saveSiteSummary calls — one for producthunt, one for hackernews, one for github. Do NOT skip any website. Each call must include BOTH English (summaryEn) and Chinese (summaryZh), each 100-200 characters. Include Markdown links for specific items mentioned.

4. After ALL 3 saveSiteSummary calls are complete, use saveFinalReport to save the final overall report in BOTH English (reportEn) and Chinese (reportZh), each 300-500 characters in Markdown format. The report should synthesize insights across all websites.

Report requirements:
- Summaries and reports must be generated in BOTH English AND Chinese
- Target indie developers, focusing on actionable opportunities and trends
- Each site summary MUST highlight 3 specific products/topics with Markdown links to the original source
- The overall report should identify cross-website commonalities and emerging directions
- Use clear, professional language

IMPORTANT: Do not call saveFinalReport until you have completed ALL 3 saveSiteSummary calls. If you skip a website's site summary, the final report will be incomplete.`;

const ALL_SITES = ["producthunt", "hackernews", "github"] as const;

const SUMMARY_PROMPT = `You are a trend analyst. Given the following raw trending data for a website, generate a short bilingual summary.

Requirements:
- English summary (100-200 chars): highlight 3 most noteworthy items with reasons. Use [Name](URL) Markdown links.
- Chinese summary (100-200 chars): same content in Chinese. Use [Name](URL) Markdown links.

Return your response as JSON: {"en": "...", "zh": "..."}`;

async function fillMissingSiteSummary(
  db: D1Database,
  model: ReturnType<typeof createDeepSeekModel>,
  date: string,
  website: string
): Promise<void> {
  const result = await getCompletedTasksByDateAndWebsite(db, date, website);
  const items = (result.results ?? [])
    .map((t) => {
      try { return t.raw_data ? JSON.parse(t.raw_data) : null; } catch { return null; }
    })
    .filter(Boolean);

  if (items.length === 0) {
    console.log(`[fill] ${website}: no data, skipping`);
    return;
  }

  const dataStr = JSON.stringify(items, null, 2).slice(0, 4000);

  try {
    const resp = await generateText({
      model,
      system: SUMMARY_PROMPT,
      prompt: `Website: ${website}\n\nRaw data:\n${dataStr}`,
      maxTokens: 500,
    });

    const text = resp.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`[fill] ${website}: no valid JSON in response`);
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { en: string; zh: string };
    if (!parsed.en || !parsed.zh) {
      console.log(`[fill] ${website}: missing en or zh in response`);
      return;
    }

    const existing = await getSummaryByDate(db, date);
    let siteSummaries: Record<string, SiteSummaryEntry> = {};
    if (existing?.site_summaries) {
      try { siteSummaries = JSON.parse(existing.site_summaries); } catch { /* ignore */ }
    }

    siteSummaries[website] = { en: parsed.en, zh: parsed.zh };

    await upsertDailySummary(db, {
      summary_date: date,
      site_summaries: JSON.stringify(siteSummaries),
    });

    console.log(`[fill] ${website}: ✅ summary backfilled`);
  } catch (err) {
    console.log(`[fill] ${website}: ❌ ${(err as Error).message}`);
  }
}

export async function runAggregation(
  db: D1Database,
  apiKey: string,
  date: string
): Promise<void> {
  const model = createDeepSeekModel(apiKey);
  const tools = createAgentTools(db, date);

  console.log("[aggregate] Starting agent loop...");
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

  // Post-validation: ensure all 3 sites have summaries
  console.log("[validate] Checking site summaries...");
  const summary = await getSummaryByDate(db, date);
  if (!summary) {
    console.log("[validate] ⚠️ No daily_summaries row found at all");
    return;
  }

  let existingSites: Record<string, SiteSummaryEntry> = {};
  if (summary.site_summaries) {
    try { existingSites = JSON.parse(summary.site_summaries); } catch { /* ignore */ }
  }

  const found = Object.keys(existingSites);
  const missing = ALL_SITES.filter((s) => !existingSites[s]);
  console.log(`[validate] Found: [${found.join(", ") || "none"}] | Missing: [${missing.join(", ") || "none"}]`);

  if (missing.length > 0) {
    console.log(`[validate] Backfilling ${missing.length} missing site summaries...`);
    for (const site of missing) {
      await fillMissingSiteSummary(db, model, date, site);
    }

    // Re-read to confirm
    const verify = await getSummaryByDate(db, date);
    if (verify?.site_summaries) {
      try {
        const v = JSON.parse(verify.site_summaries);
        console.log(`[validate] After backfill: [${Object.keys(v).join(", ")}]`);
      } catch { /* ignore */ }
    }
  } else {
    console.log("[validate] ✅ All 3 site summaries present");
  }
}
