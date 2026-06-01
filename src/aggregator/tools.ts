import { tool } from "ai";
import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import {
  getCompletedTasksByDateAndWebsite,
  upsertDailySummary,
  getSummaryByDate,
} from "../db/client";

export interface SiteSummaryEntry {
  en: string;
  zh: string;
}

export function createAgentTools(db: D1Database, date: string) {
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
      "Save the daily trend summary for a specific website. You MUST provide summaries in BOTH English (summaryEn) and Chinese (summaryZh), each 100-200 characters. Include Markdown links [Name](URL) for specific products or articles mentioned.",
    parameters: z.object({
      website: z
        .enum(["producthunt", "hackernews", "github"])
        .describe("Website identifier"),
      summaryEn: z
        .string()
        .describe("English summary of today's trends for this website (100-200 chars)"),
      summaryZh: z
        .string()
        .describe("Chinese summary of today's trends for this website (100-200 chars)"),
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
      "Save the final overall daily trend report. You MUST provide the report in BOTH English (reportEn) and Chinese (reportZh), each 300-500 characters in Markdown format. Use Markdown links [Name](URL) for specific products, repos, and articles mentioned.",
    parameters: z.object({
      reportEn: z
        .string()
        .describe(
          "Complete daily trend report in English (300-500 chars, Markdown, targeting indie developers)"
        ),
      reportZh: z
        .string()
        .describe(
          "Complete daily trend report in Chinese (300-500 chars, Markdown, targeting indie developers)"
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
    saveSiteSummary,
    saveFinalReport,
  };
}
