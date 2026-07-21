import { tool } from "ai";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import {
  getCompletedTasksByDateAndWebsite,
  upsertDailySummary,
  getSummaryByDate,
  getDailySummariesForWeek,
  upsertWeeklySummary,
  getWeeklySummaryByDate,
} from "../db/client";
import { getDateRangeForWeek } from "../utils/date";
import { searchWeb } from "./search";
import { fetchHtml } from "../utils/fetcher";
import * as cheerio from "cheerio";

export interface SiteSummaryEntry {
  en: string;
  zh: string;
}

function createWebSearchTool(logPrefix: string) {
  return tool({
    description:
      "Search the web for information about a product, topic, or keyword. Use this to gather deeper context, market insights, competitor info, or reviews about trending products. Returns up to 8 search results with title, URL, and snippet.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The search query. Be specific — include product name and what you want to know (e.g. 'What is Arc Browser?', 'Cursor AI competitor analysis', 'gpt-4o latest features 2025')."),
    }),
    execute: async ({ query }) => {
      console.log(`${logPrefix} webSearch: "${query.slice(0, 80)}"`);

      const results = await searchWeb(query);

      if (results.length === 0) {
        return {
          query,
          results: [],
          note: "No search results found for this query.",
        };
      }

      return {
        query,
        results,
        totalResults: results.length,
      };
    },
  });
}

function createWebfetchTool(logPrefix: string) {
  return tool({
    description:
      "Fetch and read the content of a web page by its URL. Use this to read full articles, product pages, GitHub READMEs, or documentation pages referenced in the scraped data. Returns the page text content (up to ~8000 characters).",
    parameters: z.object({
      url: z
        .string()
        .url()
        .describe("The full URL to fetch, e.g. https://github.com/owner/repo"),
    }),
    execute: async ({ url }) => {
      console.log(`${logPrefix} webfetch: ${url.slice(0, 120)}`);

      try {
        const html = await fetchHtml(url, 2);
        const $ = cheerio.load(html);

        $("script, style, nav, footer, header, noscript").remove();

        const text = $("body").text().replace(/\s+/g, " ").trim();
        const truncated = text.length > 8000;
        const content = text.slice(0, 8000);

        return { url, content, truncated, originalLength: text.length };
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        console.log(`${logPrefix} webfetch error for ${url.slice(0, 120)}: ${msg}`);
        return {
          url,
          content: "",
          truncated: false,
          originalLength: 0,
          error: msg,
        };
      }
    },
  });
}

// ─── Daily tools (Worker) ────────────────────────────────────────────

export function createAgentTools(db: D1Database, date: string) {
  const webSearch = createWebSearchTool("[tool]");
  const webfetch = createWebfetchTool("[tool]");

  const getRawDataByWebsite = tool({
    description:
      "Retrieve all raw scraped data for a given website on today's date. Returns JSON formatted raw content.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
    }),
    execute: async ({ website }) => {
      console.log(`[tool] getRawDataByWebsite: ${website}`);

      const result = await getCompletedTasksByDateAndWebsite(db, date, website);

      if (!result.results || result.results.length === 0) {
        return {
          website,
          date,
          items: [],
          note: `No completed tasks found for ${website} on ${date}`,
        };
      }

      const items = result.results
        .map((t) => {
          try {
            return t.raw_data ? JSON.parse(t.raw_data) : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return {
        website,
        date,
        items,
        totalItems: items.length,
      };
    },
  });

  const saveSiteSummary = tool({
    description:
      "Save the daily trend summary for a specific website. You MUST provide summaries in BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters. Format each item on its own Markdown bullet line: \"- [Category] [Name](URL) — description\". Max 10 items. Category tags: [AI], [SaaS], [DevTools], [Open Source], [Design], [Mobile], [CLI], [Framework], [Security], etc. Use Markdown links [Name](URL) for every product. Do NOT write prose paragraphs.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
      summaryEn: z
        .string()
        .describe("English summary (400-600 chars). Each item on its own bullet line: \"- [Category] [Name](URL) — description\". Max 10 items."),
      summaryZh: z
        .string()
        .describe("Chinese summary (400-600 chars). Same bullet list format. Max 10 items."),
    }),
    execute: async ({ website, summaryEn, summaryZh }) => {
      console.log(`[tool] saveSiteSummary: ${website} (en=${summaryEn.length}c, zh=${summaryZh.length}c)`);

      const existing = await getSummaryByDate(db, date);

      let siteSummaries: Record<string, SiteSummaryEntry> = {};

      if (existing?.site_summaries) {
        try {
          siteSummaries = JSON.parse(existing.site_summaries);
        } catch {
          // ignore parse error, start fresh
        }
      }

      const before = Object.keys(siteSummaries);
      siteSummaries[website] = { en: summaryEn, zh: summaryZh };
      const after = Object.keys(siteSummaries);

      console.log(`[tool] saveSiteSummary: sites before=${before.join(",") || "none"} after=${after.join(",")}`);

      await upsertDailySummary(db, {
        summary_date: date,
        site_summaries: JSON.stringify(siteSummaries),
      });

      return {
        success: true,
        website,
        date,
      };
    },
  });

  const saveFinalReport = tool({
    description:
      "Save the final overall daily trend report. You MUST provide the report in BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format. This is a ~15-minute read for indie developers. Include: cross-website trend synthesis, product commentary with insights from webSearch, competitor analysis, market implications, and actionable advice. Use Markdown links [Name](URL) for every product, repo, and article mentioned.",
    parameters: z.object({
      reportEn: z
        .string()
        .describe(
          "Complete daily trend report in English (1500-3000 chars, Markdown). Include trend synthesis, product commentary, competitor analysis, market insights, and actionable advice for indie developers."
        ),
      reportZh: z
        .string()
        .describe(
          "Complete daily trend report in Chinese (1500-3000 chars, Markdown). Include trend synthesis, product commentary, competitor analysis, market insights, and actionable advice for indie developers."
        ),
    }),
    execute: async ({ reportEn, reportZh }) => {
      const existing = await getSummaryByDate(db, date);

      const siteSummaryKeys = existing?.site_summaries
        ? (() => { try { return Object.keys(JSON.parse(existing.site_summaries)); } catch { return []; } })()
        : [];

      console.log(`[tool] saveFinalReport: sites in DB at save time = ${siteSummaryKeys.join(",") || "none"} (en=${reportEn.length}c, zh=${reportZh.length}c)`);

      await upsertDailySummary(db, {
        summary_date: date,
        full_report_en: reportEn,
        full_report_zh: reportZh,
        site_summaries: existing?.site_summaries || "{}",
      });

      return {
        success: true,
        date,
      };
    },
  });

  return {
    getRawDataByWebsite,
    webSearch,
    webfetch,
    saveSiteSummary,
    saveFinalReport,
  };
}

// ─── Daily tools (Container / in-memory) ─────────────────────────────

export function createInMemoryAgentTools(
  date: string,
  rawData: Record<string, unknown[]>
) {
  const siteSummaries: Record<string, SiteSummaryEntry> = {};
  let reportEn = "";
  let reportZh = "";
  const webSearch = createWebSearchTool("[tool:mem]");
  const webfetch = createWebfetchTool("[tool:mem]");

  const getRawDataByWebsite = tool({
    description:
      "Retrieve all raw scraped data for a given website on today's date. Returns JSON formatted raw content.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
    }),
    execute: async ({ website }) => {
      const items = rawData[website] || [];
      console.log(`[tool:mem] getRawDataByWebsite: ${website} (${items.length} items)`);

      if (items.length === 0) {
        return {
          website,
          date,
          items: [],
          note: `No data found for ${website} on ${date}`,
        };
      }

      return {
        website,
        date,
        items,
        totalItems: items.length,
      };
    },
  });

  const saveSiteSummary = tool({
    description:
      "Save the daily trend summary for a specific website. You MUST provide summaries in BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters. Format each item on its own Markdown bullet line: \"- [Category] [Name](URL) — description\". Max 10 items. Category tags: [AI], [SaaS], [DevTools], [Open Source], [Design], [Mobile], [CLI], [Framework], [Security], etc. Use Markdown links [Name](URL) for every product. Do NOT write prose paragraphs.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
      summaryEn: z
        .string()
        .describe("English summary (400-600 chars). Each item on its own bullet line: \"- [Category] [Name](URL) — description\". Max 10 items."),
      summaryZh: z
        .string()
        .describe("Chinese summary (400-600 chars). Same bullet list format. Max 10 items."),
    }),
    execute: async ({ website, summaryEn, summaryZh }) => {
      console.log(`[tool:mem] saveSiteSummary: ${website} (en=${summaryEn.length}c, zh=${summaryZh.length}c)`);
      siteSummaries[website] = { en: summaryEn, zh: summaryZh };
      return { success: true, website, date };
    },
  });

  const saveFinalReport = tool({
    description:
      "Save the final overall daily trend report. You MUST provide the report in BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format. This is a ~15-minute read for indie developers. Include: cross-website trend synthesis, product commentary with insights from webSearch, competitor analysis, market implications, and actionable advice. Use Markdown links [Name](URL) for every product, repo, and article mentioned.",
    parameters: z.object({
      reportEn: z
        .string()
        .describe(
          "Complete daily trend report in English (1500-3000 chars, Markdown). Include trend synthesis, product commentary, competitor analysis, market insights, and actionable advice for indie developers."
        ),
      reportZh: z
        .string()
        .describe(
          "Complete daily trend report in Chinese (1500-3000 chars, Markdown). Include trend synthesis, product commentary, competitor analysis, market insights, and actionable advice for indie developers."
        ),
    }),
    execute: async ({ reportEn: en, reportZh: zh }) => {
      console.log(`[tool:mem] saveFinalReport: en=${en.length}c, zh=${zh.length}c`);
      reportEn = en;
      reportZh = zh;
      return { success: true, date };
    },
  });

  return {
    tools: {
      getRawDataByWebsite,
      webSearch,
      webfetch,
      saveSiteSummary,
      saveFinalReport,
    },
    getResults: () => ({
      siteSummaries: { ...siteSummaries },
      reportEn,
      reportZh,
    }),
  };
}

// ─── Weekly tools (Worker) ──────────────────────────────────────────

export function createWeeklyAgentTools(db: D1Database, weekStartDate: string) {
  const weekDates = getDateRangeForWeek(weekStartDate);
  const weekEndDate = weekDates[6];
  const webSearch = createWebSearchTool("[tool:weekly]");
  const webfetch = createWebfetchTool("[tool:weekly]");

  const getDailySummaries = tool({
    description:
      "Retrieve all daily summaries for the past week. Each daily summary contains full bilingual reports and per-site summaries for that day. Returns 7 days of data.",
    parameters: z.object({}),
    execute: async () => {
      console.log(`[tool:weekly] getDailySummaries for week ${weekStartDate}`);

      const result = await getDailySummariesForWeek(db, weekStartDate, weekEndDate);

      const summaries = (result.results ?? []).map((s) => ({
        summary_date: s.summary_date,
        full_report_en: s.full_report_en,
        full_report_zh: s.full_report_zh,
        site_summaries: s.site_summaries,
      }));

      return {
        weekStartDate,
        weekEndDate,
        totalDays: summaries.length,
        summaries,
      };
    },
  });

  const saveSiteSummary = tool({
    description:
      "Save the weekly trend summary for a specific website. Synthesize the week's daily summaries into a concise weekly overview. Provide BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters. Format each item on its own Markdown bullet line: \"- [Category] [Name](URL) — description\". Max 10 items.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
      summaryEn: z
        .string()
        .describe("English weekly summary (400-600 chars)"),
      summaryZh: z
        .string()
        .describe("Chinese weekly summary (400-600 chars)"),
    }),
    execute: async ({ website, summaryEn, summaryZh }) => {
      console.log(`[tool:weekly] saveSiteSummary: ${website} (en=${summaryEn.length}c, zh=${summaryZh.length}c)`);

      const existing = await getWeeklySummaryByDate(db, weekStartDate);

      let siteSummaries: Record<string, SiteSummaryEntry> = {};

      if (existing?.site_summaries) {
        try {
          siteSummaries = JSON.parse(existing.site_summaries);
        } catch {
          // ignore parse error
        }
      }

      siteSummaries[website] = { en: summaryEn, zh: summaryZh };

      await upsertWeeklySummary(db, {
        week_start_date: weekStartDate,
        site_summaries: JSON.stringify(siteSummaries),
      });

      return {
        success: true,
        website,
        weekStartDate,
      };
    },
  });

  const saveFinalReport = tool({
    description:
      "Save the final overall weekly trend report. Synthesize all 7 daily reports into a comprehensive weekly overview. Provide BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format. Include: (a) Week Overview — key themes and trends across all days, (b) Standout Products — products that appeared repeatedly or gained momentum, (c) Cross-Domain Patterns — connections between PH, HN, and GitHub, (d) Indie Developer Insights — actionable takeaways for the week.",
    parameters: z.object({
      reportEn: z
        .string()
        .describe(
          "Complete weekly trend report in English (1500-3000 chars, Markdown)"
        ),
      reportZh: z
        .string()
        .describe(
          "Complete weekly trend report in Chinese (1500-3000 chars, Markdown)"
        ),
    }),
    execute: async ({ reportEn, reportZh }) => {
      console.log(`[tool:weekly] saveFinalReport: en=${reportEn.length}c, zh=${reportZh.length}c`);

      await upsertWeeklySummary(db, {
        week_start_date: weekStartDate,
        full_report_en: reportEn,
        full_report_zh: reportZh,
      });

      return {
        success: true,
        weekStartDate,
      };
    },
  });

  return {
    getDailySummaries,
    webSearch,
    webfetch,
    saveSiteSummary,
    saveFinalReport,
  };
}

// ─── Weekly tools (Container / in-memory) ───────────────────────────

export function createInMemoryWeeklyAgentTools(
  weekStartDate: string,
  dailySummaries: Array<{
    summary_date: string;
    full_report_en: string;
    full_report_zh: string;
    site_summaries: string;
  }>
) {
  const siteSummaries: Record<string, SiteSummaryEntry> = {};
  let reportEn = "";
  let reportZh = "";
  const webSearch = createWebSearchTool("[tool:mem:weekly]");
  const webfetch = createWebfetchTool("[tool:mem:weekly]");

  const getDailySummaries = tool({
    description:
      "Retrieve all daily summaries for the past week. Each daily summary contains full bilingual reports and per-site summaries for that day.",
    parameters: z.object({}),
    execute: async () => {
      console.log(`[tool:mem:weekly] getDailySummaries: ${dailySummaries.length} days`);

      return {
        weekStartDate,
        totalDays: dailySummaries.length,
        summaries: dailySummaries,
      };
    },
  });

  const saveSiteSummary = tool({
    description:
      "Save the weekly trend summary for a specific website. Synthesize the week's daily summaries into a concise weekly overview. Provide BOTH English (summaryEn) and Chinese (summaryZh), each 400-600 characters.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
      summaryEn: z
        .string()
        .describe("English weekly summary (400-600 chars)"),
      summaryZh: z
        .string()
        .describe("Chinese weekly summary (400-600 chars)"),
    }),
    execute: async ({ website, summaryEn, summaryZh }) => {
      console.log(`[tool:mem:weekly] saveSiteSummary: ${website} (en=${summaryEn.length}c, zh=${summaryZh.length}c)`);
      siteSummaries[website] = { en: summaryEn, zh: summaryZh };
      return { success: true, website, weekStartDate };
    },
  });

  const saveFinalReport = tool({
    description:
      "Save the final overall weekly trend report. Synthesize all 7 daily reports into a comprehensive weekly overview. Provide BOTH English (reportEn) and Chinese (reportZh), each 1500-3000 characters in Markdown format.",
    parameters: z.object({
      reportEn: z
        .string()
        .describe("Complete weekly trend report in English (1500-3000 chars, Markdown)"),
      reportZh: z
        .string()
        .describe("Complete weekly trend report in Chinese (1500-3000 chars, Markdown)"),
    }),
    execute: async ({ reportEn: en, reportZh: zh }) => {
      console.log(`[tool:mem:weekly] saveFinalReport: en=${en.length}c, zh=${zh.length}c`);
      reportEn = en;
      reportZh = zh;
      return { success: true, weekStartDate };
    },
  });

  return {
    tools: {
      getDailySummaries,
      webSearch,
      webfetch,
      saveSiteSummary,
      saveFinalReport,
    },
    getResults: () => ({
      siteSummaries: JSON.parse(JSON.stringify(siteSummaries)),
      reportEn,
      reportZh,
    }),
  };
}
