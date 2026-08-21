import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolExecutionOptions } from "ai";
import { createWeeklyAgentTools } from "./tools";
import { createInMemoryWeeklyAgentTools } from "./tools";
import { newStmt, mockD1 } from "../test-utils/d1-mock";

vi.mock("./search", () => ({
  searchWeb: vi.fn(),
}));

vi.mock("./image-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./image-search")>();
  return {
    ...actual,
    searchImages: vi.fn(),
    selectBestImage: vi.fn(),
    resolveItemImage: vi.fn(),
  };
});

import { searchWeb } from "./search";
import { searchImages, selectBestImage, resolveItemImage } from "./image-search";

const execOpts = {} as ToolExecutionOptions;

beforeEach(() => {
  vi.clearAllMocks();
});

const arcCandidate = {
  title: "Arc Browser",
  thumbnail: "https://thumbs.example.com/arc.jpg",
  image: "https://example.com/arc.jpg",
  sourceUrl: "https://arc.net",
};

const sampleDailySummaries = [
  {
    summary_date: "2026-06-01",
    full_report_en: "## Monday Report\nTrending: AI tools",
    full_report_zh: "## 周一报告\n趋势：AI 工具",
    site_summaries: JSON.stringify({
      producthunt: { en: "PH Mon", zh: "PH 周一" },
      hackernews: { en: "HN Mon", zh: "HN 周一" },
    }),
  },
  {
    summary_date: "2026-06-02",
    full_report_en: "## Tuesday Report\nTrending: Dev tools",
    full_report_zh: "## 周二报告\n趋势：开发工具",
    site_summaries: JSON.stringify({
      producthunt: { en: "PH Tue", zh: "PH 周二" },
    }),
  },
];

describe("createInMemoryWeeklyAgentTools", () => {
  const weekStartDate = "2026-06-01";

  describe("getDailySummaries", () => {
    it("returns pre-loaded daily summaries", async () => {
      const { tools } = createInMemoryWeeklyAgentTools(weekStartDate, sampleDailySummaries);
      const result = await tools.getDailySummaries.execute({}, execOpts);

      expect(result.totalDays).toBe(2);
      expect(result.summaries).toHaveLength(2);
      expect(result.summaries[0].summary_date).toBe("2026-06-01");
      expect(result.weekStartDate).toBe(weekStartDate);
    });

    it("handles empty daily summaries array", async () => {
      const { tools } = createInMemoryWeeklyAgentTools(weekStartDate, []);
      const result = await tools.getDailySummaries.execute({}, execOpts);

      expect(result.totalDays).toBe(0);
      expect(result.summaries).toEqual([]);
    });
  });

  describe("saveSiteSummary", () => {
    it("stores summary in memory and returns success", async () => {
      const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);

      await tools.saveSiteSummary.execute({
        website: "producthunt",
        summaryEn: "Weekly PH summary EN",
        summaryZh: "Weekly PH summary ZH",
      }, execOpts);

      const results = getResults();
      expect(results.siteSummaries.producthunt).toEqual({
        en: "Weekly PH summary EN",
        zh: "Weekly PH summary ZH",
      });
    });

    it("accumulates summaries across calls", async () => {
      const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);

      await tools.saveSiteSummary.execute({
        website: "producthunt", summaryEn: "PH", summaryZh: "PH_Z",
      }, execOpts);
      await tools.saveSiteSummary.execute({
        website: "hackernews", summaryEn: "HN", summaryZh: "HN_Z",
      }, execOpts);

      const results = getResults();
      expect(Object.keys(results.siteSummaries)).toHaveLength(2);
    });

    it("overwrites an existing site summary on re-save", async () => {
      const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);

      await tools.saveSiteSummary.execute({
        website: "github", summaryEn: "First", summaryZh: "第一",
      }, execOpts);
      await tools.saveSiteSummary.execute({
        website: "github", summaryEn: "Updated", summaryZh: "更新",
      }, execOpts);

      const results = getResults();
      expect(results.siteSummaries.github.en).toBe("Updated");
    });
  });

  describe("saveFinalReport", () => {
    it("stores bilingual report in memory", async () => {
      const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);

      await tools.saveFinalReport.execute({
        reportEn: "Weekly report EN",
        reportZh: "Weekly report ZH",
      }, execOpts);

      const results = getResults();
      expect(results.reportEn).toBe("Weekly report EN");
      expect(results.reportZh).toBe("Weekly report ZH");
    });
  });

  describe("webSearch", () => {
    it("delegates to searchWeb and returns results", async () => {
      const { tools } = createInMemoryWeeklyAgentTools(weekStartDate, []);
      vi.mocked(searchWeb).mockResolvedValueOnce([
        { title: "Test", url: "https://example.com", snippet: "Snippet" },
      ]);

      const result = await tools.webSearch.execute({ query: "test query" }, execOpts);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe("Test");
      expect(result.query).toBe("test query");
    });

    it("handles empty search results", async () => {
      const { tools } = createInMemoryWeeklyAgentTools(weekStartDate, []);
      vi.mocked(searchWeb).mockResolvedValueOnce([]);

      const result = await tools.webSearch.execute({ query: "zzz" }, execOpts);

      expect(result.results).toHaveLength(0);
      expect(result.note).toContain("No search results");
    });
  });

  describe("getResults", () => {
    it("returns empty state initially", () => {
      const { getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);

      const results = getResults();
      expect(results.siteSummaries).toEqual({});
      expect(results.reportEn).toBe("");
      expect(results.reportZh).toBe("");
    });

    it("returns a copy of internal state", () => {
      const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);

      tools.saveSiteSummary.execute({
        website: "producthunt", summaryEn: "PH", summaryZh: "PH_Z",
      }, execOpts);

      const results = getResults();
      results.siteSummaries.producthunt.en = "MUTATED";
      const results2 = getResults();
      expect(results2.siteSummaries.producthunt.en).toBe("PH");
    });
  });
});

describe("createWeeklyAgentTools", () => {
  const weekStartDate = "2026-06-01";

  describe("getDailySummaries", () => {
    it("returns daily summaries from D1", async () => {
      const s = newStmt();
      s.all.mockResolvedValue({
        results: sampleDailySummaries,
      });
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);
      const result = await tools.getDailySummaries.execute({}, execOpts);

      expect(result.totalDays).toBe(2);
      expect(result.weekStartDate).toBe(weekStartDate);
    });

    it("returns 0 days when no summaries exist", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      const result = await tools.getDailySummaries.execute({}, execOpts);

      expect(result.totalDays).toBe(0);
      expect(result.summaries).toEqual([]);
    });
  });

  describe("saveSiteSummary", () => {
    it("saves to D1 with correct week_start_date", async () => {
      const s = newStmt();
      s.first.mockResolvedValue(null);
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      await tools.saveSiteSummary.execute({
        website: "producthunt",
        summaryEn: "PH weekly EN",
        summaryZh: "PH weekly ZH",
      }, execOpts);

      expect(m.prepare).toHaveBeenCalled();
    });

    it("merges with existing site summaries", async () => {
      const s = newStmt();
      s.first
        .mockResolvedValueOnce({ site_summaries: JSON.stringify({ hackernews: { en: "HN", zh: "黑客" } }) })
        .mockResolvedValueOnce(null);
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      await tools.saveSiteSummary.execute({
        website: "producthunt",
        summaryEn: "New PH",
        summaryZh: "新 PH",
      }, execOpts);

      expect(s.first).toHaveBeenCalled();
    });
  });

  describe("saveFinalReport", () => {
    it("saves bilingual final report to D1", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      const result = await tools.saveFinalReport.execute({
        reportEn: "## Weekly Report EN",
        reportZh: "## 周报 ZH",
      }, execOpts);

      expect(result.success).toBe(true);
    });
  });

  describe("searchImages", () => {
    it("returns selected images for each item", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      vi.mocked(searchImages).mockResolvedValue([arcCandidate]);
      vi.mocked(selectBestImage).mockResolvedValue(arcCandidate);

      const result = await tools.searchImages.execute(
        { website: "producthunt", items: [{ name: "Arc Browser" }] },
        execOpts
      );
      expect(result.images).toEqual([
        { name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" },
      ]);
      expect(result.totalFound).toBe(1);
    });

    it("uses the item's own image found in the daily summaries", async () => {
      const s = newStmt();
      s.all.mockResolvedValue({
        results: [
          {
            summary_date: "2026-06-01",
            site_summaries: JSON.stringify({
              producthunt: {
                en: "- [AI] [Arc Browser](https://ph.example.com/arc) — a browser",
                zh: "- [AI] [Arc Browser](https://ph.example.com/arc) — 浏览器",
              },
            }),
          },
        ],
      });
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      vi.mocked(resolveItemImage).mockResolvedValue("https://own.example.com/arc.jpg");

      const result = await tools.searchImages.execute(
        { website: "producthunt", items: [{ name: "Arc Browser" }] },
        execOpts
      );

      expect(resolveItemImage).toHaveBeenCalledWith("https://ph.example.com/arc");
      expect(result.images).toEqual([
        { name: "Arc Browser", url: "https://own.example.com/arc.jpg" },
      ]);
      expect(searchImages).not.toHaveBeenCalled();
    });

    it("omits items with no usable image", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      vi.mocked(searchImages).mockResolvedValue([]);
      vi.mocked(selectBestImage).mockResolvedValue(null);

      const result = await tools.searchImages.execute(
        { website: "producthunt", items: [{ name: "Nope" }] },
        execOpts
      );
      expect(result.images).toEqual([]);
      expect(result.totalFound).toBe(0);
    });
  });

  describe("saveSiteSummary with images", () => {
    it("persists images alongside the weekly summary", async () => {
      const s = newStmt();
      s.first.mockResolvedValue(null);
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createWeeklyAgentTools(db, weekStartDate);

      await tools.saveSiteSummary.execute({
        website: "producthunt",
        summaryEn: "PH weekly EN",
        summaryZh: "PH weekly ZH",
        images: [{ name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" }],
      }, execOpts);

      const jsonArg = s.bind.mock.calls
        .flat()
        .find((a) => typeof a === "string" && a.includes('"images"'));
      expect(jsonArg).toBeTruthy();
      const parsed = JSON.parse(jsonArg as string);
      expect(parsed.producthunt.images).toEqual([
        { name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" },
      ]);
    });
  });
});

describe("createInMemoryWeeklyAgentTools with images", () => {
  const weekStartDate = "2026-06-01";

  it("keeps images in site summary results", async () => {
    const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, []);
    await tools.saveSiteSummary.execute({
      website: "github",
      summaryEn: "GH weekly EN",
      summaryZh: "GH weekly ZH",
      images: [{ name: "repo", url: "https://thumbs.example.com/r.jpg" }],
    }, execOpts);

    expect(getResults().siteSummaries.github.images).toEqual([
      { name: "repo", url: "https://thumbs.example.com/r.jpg" },
    ]);
  });

  it("exposes a searchImages tool", async () => {
    const { tools } = createInMemoryWeeklyAgentTools(weekStartDate, []);
    vi.mocked(searchImages).mockResolvedValue([arcCandidate]);
    vi.mocked(selectBestImage).mockResolvedValue(arcCandidate);

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }] },
      execOpts
    );
    expect(result.images).toHaveLength(1);
  });

  it("resolves the item URL from the in-memory daily summaries", async () => {
    const { tools } = createInMemoryWeeklyAgentTools(weekStartDate, [
      {
        summary_date: "2026-06-01",
        full_report_en: "",
        full_report_zh: "",
        site_summaries: JSON.stringify({
          producthunt: {
            en: "- [AI] [Arc Browser](https://ph.example.com/arc) — a browser",
            zh: "- [AI] [Arc Browser](https://ph.example.com/arc) — 浏览器",
          },
        }),
      },
    ]);
    vi.mocked(resolveItemImage).mockResolvedValue("https://own.example.com/arc.jpg");

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }] },
      execOpts
    );

    expect(resolveItemImage).toHaveBeenCalledWith("https://ph.example.com/arc");
    expect(result.images).toEqual([
      { name: "Arc Browser", url: "https://own.example.com/arc.jpg" },
    ]);
    expect(searchImages).not.toHaveBeenCalled();
  });
});
