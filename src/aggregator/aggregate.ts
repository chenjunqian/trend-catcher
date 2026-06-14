import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import type { D1Database } from "@cloudflare/workers-types";
import { createDeepSeekModel } from "./llm";
import { createAgentTools, type SiteSummaryEntry } from "./tools";
import {
  getSummaryByDate,
  getCompletedTasksByDateAndWebsite,
  upsertDailySummary,
} from "../db/client";

export const SYSTEM_PROMPT = `You are a professional product trend analyst specializing in providing daily trend insights for indie developers.

Your tools and workflow:
1. Use getRawDataByWebsite to retrieve raw data from ALL three websites: producthunt, hackernews, github. You MUST call it 3 times.

2. Review the raw data from each website. For the most promising/interesting products and topics, use webSearch to research them deeply — look for product details, launch context, market positioning, competitor landscape, community reception, and business model. Use at least 3-5 webSearch calls per website to gather rich context.

3. Analyze the data for each website and identify up to 10 noteworthy products or topics per site. Tag each with a category: [AI], [SaaS], [DevTools], [Open Source], [Design], [Mobile], [CLI], [Framework], [Security], [Infrastructure], [Data], [No-Code], [Productivity], etc. Format each item on its own Markdown bullet list line: "- [Category] [Name](URL) — description". Do NOT write prose paragraphs. ALWAYS use Markdown link format [Name](URL) from the raw data. Incorporate insights from webSearch into each item's description.

4. Use saveSiteSummary to save a summary for EACH website individually. CRITICAL: You MUST make exactly 3 saveSiteSummary calls — one for producthunt, one for hackernews, one for github. Do NOT skip any website. Each call must include BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters. List up to 10 items per site with [Category] tags and Markdown links.

5. After ALL 3 saveSiteSummary calls are complete, use saveFinalReport to save the final overall report in BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format. This should be a ~15-minute read for indie developers. Structure the report with sections: (a) Cross-Website Trend Synthesis — what themes appear across sites, (b) Product Deep Dives — commentary and analysis on 3-5 standout products with webSearch insights, (c) Market Implications — what these trends mean for indie developers, (d) Actionable Opportunities — specific ideas and advice for builders.

Report requirements:
- Summaries and reports must be generated in BOTH English AND Chinese
- Target indie developers, focusing on actionable opportunities and trends
- Each site summary MUST list up to 10 products/topics with [Category] tags and Markdown links
- The overall report should identify cross-website commonalities, provide deep commentary on key products, market analysis, and concrete advice for indie developers
- Use the webSearch tool extensively to enrich your analysis with real-world context

Translation rules for Chinese content (CRITICAL):
- Preserve ALL product names, tool names, company names, project names, and brand names in their original English form — do NOT translate them
- Keep technical terms and jargon in English (e.g., API, SDK, CLI, LLM, RAG, vector database, fine-tuning, edge computing). If you add a Chinese explanation, always append the original English term in parentheses after it
- GitHub repository names (owner/repo), package names, and command-line tools must remain in their original form
- Markdown link text [Name](URL) must keep 'Name' in the original language — only translate the surrounding descriptive text
- When unsure whether a term is a proper name, keep it in English

IMPORTANT: Do not call saveFinalReport until you have completed ALL 3 saveSiteSummary calls. If you skip a website's site summary, the final report will be incomplete.`;

export const MAX_STEPS = 20;

const ALL_SITES = ["producthunt", "hackernews", "github"] as const;

const SUMMARY_PROMPT = `You are a trend analyst. Given the following raw trending data for a website, generate a bilingual summary.

Requirements:
- English summary (400-600 chars): format each item on its own bullet line: "- [Category] [Name](URL) — brief reason". Max 10 items. Use [Name](URL) Markdown links for every item.
- Chinese summary (400-600 chars): same bullet list format in Chinese. IMPORTANT: preserve all product names, tool names, and technical terms in their original English form — do NOT translate them. Markdown link text [Name](URL) must remain in the original language.

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
      maxTokens: 1200,
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

export async function runAgentLoop(
  model: LanguageModelV1,
  tools: Record<string, unknown>,
  systemPrompt: string,
  maxSteps: number
): Promise<void> {
  console.log("[agent] Starting agent loop...");
  await generateText({
    model,
    system: systemPrompt,
    prompt:
      "Please retrieve today's trending data from Product Hunt, Hacker News, and GitHub Trending. Analyze each source, save individual site summaries in both English and Chinese, then generate a comprehensive bilingual daily report for indie developers.",
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
  console.log("[agent] Agent loop completed");
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
    maxSteps: MAX_STEPS,
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

