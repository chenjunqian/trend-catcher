import { tool } from "ai";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import {
  getDailySummariesForWeek,
  upsertWeeklySummary,
  getWeeklySummaryByDate,
} from "../db/client";
import { getDateRangeForWeek } from "../utils/date";
import { searchWeb } from "./search";
import type { SiteSummaryEntry } from "./tools";

export function createWeeklyAgentTools(db: D1Database, weekStartDate: string) {
  const weekDates = getDateRangeForWeek(weekStartDate);
  const weekEndDate = weekDates[6];

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

  const webSearchTool = tool({
    description:
      "Search the web for information about a product, topic, or keyword. Use this to gather deeper context for the weekly analysis.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The search query. Be specific."),
    }),
    execute: async ({ query }) => {
      console.log(`[tool:weekly] webSearch: "${query.slice(0, 80)}"`);

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
    webSearch: webSearchTool,
    saveSiteSummary,
    saveFinalReport,
  };
}

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

  const webSearchTool = tool({
    description:
      "Search the web for information about a product, topic, or keyword. Use this to gather deeper context for the weekly analysis.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The search query. Be specific."),
    }),
    execute: async ({ query }) => {
      console.log(`[tool:mem:weekly] webSearch: "${query.slice(0, 80)}"`);

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
      webSearch: webSearchTool,
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
