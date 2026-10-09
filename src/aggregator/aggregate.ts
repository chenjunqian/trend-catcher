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

export const SYSTEM_PROMPT = `You are a professional product trend analyst and senior commercial SEO & market research specialist, providing daily actionable trend insights for indie developers.

Your tools and workflow:
1. Use getRawDataByWebsite to retrieve raw technical supply data from producthunt, hackernews, and github. (You may also check googletrends, but demand-side discovery is dynamically formulated in step 2).

2. Review the raw data and conduct deep research:
- Deep Tech Research: Use webSearch to research noteworthy products, topics, and trends deeply — look for product details, launch context, market positioning, competitor landscape, community reception, and business model. Use at least 3-5 webSearch calls to gather rich context.
- Senior SEO Specialist & Autonomous Demand Probing (CRITICAL): Do NOT trap yourself in the "developer tools" echo chamber, and do NOT rely on fixed, static search seeds (like contractors or photographers every day). Instead, examine today's supply-side technology breakthroughs from Product Hunt, Hacker News, and GitHub (e.g. on-device AI models, browser automation, security scanners, canvas interfaces, workflow orchestration). As a senior SEO specialist, ask: "Who outside the tech industry (SMBs, vertical professions, solo operators) needs this capability to solve an expensive, repetitive pain point?"
  Autonomously formulate 4-8 dynamic commercial search seeds spanning 4 key search intent dimensions:
  * [Alternative Demand]: 'alternative to [expensive/monopoly legacy tool] for [small business/solo]' (escaping high-priced incumbents across verticals)
  * [Workflow Automation]: '[profession] [repetitive manual task] software/tool/template' (automating painful paper/manual workflows)
  * [Solo/SMB Micro-SaaS]: 'simple crm for [niche]', 'booking system for [industry]', 'best [tool] for solo [profession]'
  * [Applied AI Intent]: 'ai [capability] for [traditional non-tech role]' (applying lightweight AI to real-world vertical jobs)
  Proactive Batch Validation: Call googleSuggest with your batch of dynamic seeds (using queries: [...]) to probe Google Autocomplete for real-world user search demand, long-tail qualifiers (free, app, template, alternative, pricing), and verify organic search demand.

3. Analyze the data for each website and identify up to 10 noteworthy products, topics, or search trends per site:
- For producthunt, hackernews, and github: Tag each item with a category: [AI], [SaaS], [DevTools], [Open Source], [Design], [Mobile], [CLI], [Framework], [Security], [Infrastructure], [Data], [No-Code], [Productivity], etc. Format each item on its own Markdown bullet line: "- [Category] [Name](URL) — description". Do NOT write prose paragraphs. Use Markdown link format [Name](URL) from the raw data.
- For googletrends specifically: Do NOT merely regurgitate raw seeds from the scraper. Your googletrends summary MUST highlight verified high-intent search queries discovered through your dynamic SEO probes and Autocomplete validation. Categorize items with intent tags: [Alternative Demand], [Workflow Automation], [Solo/SMB Micro-SaaS], [Applied AI Intent], or [Search Trends]. Format each item as "- [Category] [Verified Query](URL) — targeted SMB persona, core friction/pain point, and validated intent". Use the Google Trends explore URL or Google search URL returned by googleSuggest.

4. Use saveSiteSummary to save a summary for EACH website individually. CRITICAL: You MUST make exactly 4 saveSiteSummary calls — one for producthunt, one for hackernews, one for github, one for googletrends. Do NOT skip any website. Each call must include BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters. List up to 10 items per site with [Category] tags and Markdown links.

5. After ALL 4 saveSiteSummary calls are complete, use saveFinalReport to save the final overall report in BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format. This should be a ~15-minute read for indie developers. Structure the report with sections: (a) Cross-Platform Trend Synthesis — what themes appear across sites and search trends, (b) Product & Demand Deep Dives — commentary and analysis on 3-5 standout products and rising search demands with webSearch and googleSuggest insights, (c) Market & Search Implications — what these trends and user search queries mean for indie developers, (d) Actionable Niche Opportunities — specific ideas, low-competition keywords, and advice for builders, emphasizing vertical micro-SaaS and non-technical business pain points.

Report requirements:
- Summaries and reports must be generated in BOTH English AND Chinese
- Target indie developers, focusing on actionable opportunities, concrete pain points, and commercial trends
- Break the developer echo chamber: actively bridge developer/tech supply (Product Hunt, GitHub) with non-technical vertical industries and small business workflows (Google Trends / Search Demand) where customer willingness to pay is high and self-hosting is non-existent
- Strict noise filtering: NEVER include pure sports scores, schedules, player injuries (e.g. NFL, MLB, NBA, NHL), celebrity gossip, or ephemeral sensationalist news. Only analyze topics with clear technology, software, product, or commercial business relevance
- Demand-side reverse-engineering: treat Google Trends and search queries as user pain points, unfulfilled software needs, or desires for alternatives. Reverse-engineer why existing solutions fall short and how an indie developer can build a lightweight MVP (micro-SaaS, extension, CLI, self-hosted tool)
- Each site summary MUST list up to 10 products/topics with [Category] tags and Markdown links
- The overall report should identify cross-website commonalities (connecting supply on Product Hunt/GitHub with demand in Google search), provide deep commentary on key products, market analysis, and concrete advice for indie developers
- Use the webSearch and googleSuggest tools to enrich your analysis with real-world search demand context

Translation rules for Chinese content (CRITICAL):
- Preserve ALL product names, tool names, company names, project names, and brand names in their original English form — do NOT translate them
- Keep technical terms and jargon in English (e.g., API, SDK, CLI, LLM, RAG, vector database, fine-tuning, edge computing). If you add a Chinese explanation, always append the original English term in parentheses after it
- GitHub repository names (owner/repo), package names, and command-line tools must remain in their original form
- Markdown link text [Name](URL) must keep 'Name' in the original language — only translate the surrounding descriptive text
- When unsure whether a term is a proper name, keep it in English

IMPORTANT: Do not call saveFinalReport until you have completed ALL 4 saveSiteSummary calls. If you skip a website's site summary, the final report will be incomplete.`;

export const MAX_STEPS = 35;

const ALL_SITES = ["producthunt", "hackernews", "github", "googletrends"] as const;

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
      "Please retrieve today's trending technical supply from Product Hunt, Hacker News, and GitHub Trending. Formulate dynamic commercial search seeds to probe Google search trends, save individual site summaries for all 4 sites (producthunt, hackernews, github, googletrends) in both English and Chinese, then generate a comprehensive bilingual daily report for indie developers.",
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
      "Please retrieve today's trending technical supply from Product Hunt, Hacker News, and GitHub Trending. Formulate dynamic commercial search seeds to probe Google search trends, save individual site summaries for all 4 sites (producthunt, hackernews, github, googletrends) in both English and Chinese, then generate a comprehensive bilingual daily report for indie developers.",
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

  const status = await ensureCompleteSummary(db, model, date);
  if (!status.complete) {
    throw new Error(
      `Daily summary incomplete for ${date}: missing sites [${status.missingSites.join(", ") || "none"}]${status.missingReport ? ", missing full report" : ""}`
    );
  }
}

export interface SummaryCompleteness {
  complete: boolean;
  missingSites: string[];
  missingReport: boolean;
}

export async function ensureCompleteSummary(
  db: D1Database,
  model: ReturnType<typeof createDeepSeekModel>,
  date: string
): Promise<SummaryCompleteness> {
  console.log("[validate] Checking site summaries...");
  const summary = await getSummaryByDate(db, date);
  if (!summary) {
    console.log("[validate] ⚠️ No daily_summaries row found at all");
  }

  let existingSites: Record<string, SiteSummaryEntry> = {};
  if (summary?.site_summaries) {
    try { existingSites = JSON.parse(summary.site_summaries); } catch { /* ignore */ }
  }

  const missing = ALL_SITES.filter((s) => !existingSites[s]);
  console.log(`[validate] Found: [${Object.keys(existingSites).join(", ") || "none"}] | Missing: [${missing.join(", ") || "none"}]`);

  if (missing.length > 0) {
    console.log(`[validate] Backfilling ${missing.length} missing site summaries...`);
    for (const site of missing) {
      await fillMissingSiteSummary(db, model, date, site);
    }
  }

  const verify = await getSummaryByDate(db, date);
  let verifiedSites: Record<string, SiteSummaryEntry> = {};
  if (verify?.site_summaries) {
    try { verifiedSites = JSON.parse(verify.site_summaries); } catch { /* ignore */ }
  }

  const missingSites = ALL_SITES.filter((s) => !verifiedSites[s]);
  const missingReport = !verify?.full_report_en || !verify?.full_report_zh;
  console.log(`[validate] After backfill: [${Object.keys(verifiedSites).join(", ") || "none"}] | Report: ${missingReport ? "missing" : "present"}`);

  return {
    complete: missingSites.length === 0 && !missingReport,
    missingSites: [...missingSites],
    missingReport,
  };
}

