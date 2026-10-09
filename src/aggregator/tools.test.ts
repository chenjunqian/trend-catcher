import { describe, it, expect, vi } from "vitest";
import type { ToolExecutionOptions } from "ai";
import { createAgentTools } from "./tools";
import { newStmt, mockD1 } from "../test-utils/d1-mock";

vi.mock("./search", () => ({
  searchWeb: vi.fn(),
}));

import { searchWeb } from "./search";

const execOpts = {} as ToolExecutionOptions;

describe("createAgentTools", () => {
  const date = "2026-06-01";

  describe("getRawDataByWebsite", () => {
    it("returns data when tasks are completed", async () => {
      const s = newStmt();
      s.all.mockResolvedValue({
        results: [
          { raw_data: JSON.stringify({ name: "Foo" }) },
          { raw_data: JSON.stringify({ name: "Bar" }) },
        ],
      });
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.getRawDataByWebsite.execute({ website: "hackernews" }, execOpts);
      expect(result.website).toBe("hackernews");
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ name: "Foo" });
    });

    it("returns empty items when no tasks found", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.getRawDataByWebsite.execute({ website: "producthunt" }, execOpts);
      expect(result.items).toHaveLength(0);
      expect(result.note).toContain("No completed tasks found");
    });

    it("filters out unparseable raw_data", async () => {
      const s = newStmt();
      s.all.mockResolvedValue({
        results: [
          { raw_data: "not-json" },
          { raw_data: JSON.stringify({ valid: true }) },
        ],
      });
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.getRawDataByWebsite.execute({ website: "github" }, execOpts);
      expect(result.items).toHaveLength(1);
    });

    it("returns googletrends data when tasks are completed", async () => {
      const s = newStmt();
      s.all.mockResolvedValue({
        results: [
          { raw_data: JSON.stringify([{ title: "deepseek", approxTraffic: "50K+" }]) },
        ],
      });
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.getRawDataByWebsite.execute({ website: "googletrends" }, execOpts);
      expect(result.website).toBe("googletrends");
      expect(result.items).toHaveLength(1);
    });
  });

  describe("saveSiteSummary", () => {
    it("saves a summary for a website", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.saveSiteSummary.execute({
        website: "producthunt",
        summaryEn: "Top products today",
        summaryZh: "今日精选",
      }, execOpts);
      expect(result.success).toBe(true);
      expect(result.website).toBe("producthunt");
    });

    it("saves a summary for googletrends", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.saveSiteSummary.execute({
        website: "googletrends",
        summaryEn: "Search trends",
        summaryZh: "搜索趋势",
      }, execOpts);
      expect(result.success).toBe(true);
      expect(result.website).toBe("googletrends");
    });

    it("merges with existing site summaries", async () => {
      const s = newStmt();
      s.first
        .mockResolvedValueOnce({ site_summaries: JSON.stringify({ hackernews: { en: "HN", zh: "黑客" } }) })
        .mockResolvedValueOnce(null);
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      await tools.saveSiteSummary.execute({
        website: "producthunt",
        summaryEn: "New PH",
        summaryZh: "新的 PH",
      }, execOpts);
      expect(s.first).toHaveBeenCalled();
    });
  });

  describe("googleSuggest", () => {
    it("returns autocomplete suggestions", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(["cursor", ["cursor ai", "cursor alternative"]]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      ) as typeof globalThis.fetch;

      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.googleSuggest.execute({ query: "cursor" }, execOpts);
      expect(result.query).toBe("cursor");
      expect(result.suggestions).toEqual(["cursor ai", "cursor alternative"]);
      expect(result.totalSuggestions).toBe(2);
    });

    it("supports batch probing with multiple queries", async () => {
      globalThis.fetch = vi.fn((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("clio")) {
          return Promise.resolve(
            new Response(
              JSON.stringify(["alternative to clio", ["alternative to clio for solo", "alternative to clio free"]]),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify(["software for roofers", ["software for roofers free", "software for roofers takeoff"]]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }) as typeof globalThis.fetch;

      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.googleSuggest.execute(
        { queries: ["alternative to clio", "software for roofers"] },
        execOpts
      );
      expect(result.totalQueries).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].query).toBe("alternative to clio");
      expect(result.results[0].suggestions).toEqual(["alternative to clio for solo", "alternative to clio free"]);
      expect(result.results[0].exploreUrl).toContain("trends.google.com");
      expect(result.results[1].query).toBe("software for roofers");
    });
  });

  describe("webSearch", () => {
    it("returns search results", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      vi.mocked(searchWeb).mockResolvedValueOnce([
        { title: "Arc Browser", url: "https://arc.net", snippet: "A better web browser" },
        { title: "Arc Browser review", url: "https://example.com/review", snippet: "Review of Arc" },
      ]);
      const result = await tools.webSearch.execute({ query: "What is Arc Browser?" }, execOpts);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe("Arc Browser");
      expect(result.query).toBe("What is Arc Browser?");
    });

    it("returns empty results with note when search finds nothing", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      vi.mocked(searchWeb).mockResolvedValueOnce([]);
      const result = await tools.webSearch.execute({ query: "xyznonexistent12345" }, execOpts);
      expect(result.results).toHaveLength(0);
      expect(result.note).toContain("No search results");
    });

    it("limits query length to valid range", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      vi.mocked(searchWeb).mockResolvedValueOnce([{ title: "X", url: "https://x.com", snippet: "X" }]);
      const result = await tools.webSearch.execute({ query: "a".repeat(500) }, execOpts);
      expect(result.results).toHaveLength(1);
      expect(searchWeb).toHaveBeenCalledWith("a".repeat(500));
    });
  });

  describe("saveFinalReport", () => {
    it("saves a bilingual final report", async () => {
      const m = mockD1();
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.saveFinalReport.execute({
        reportEn: "## Today's trends in English",
        reportZh: "## 今日趋势中文版",
      }, execOpts);
      expect(result.success).toBe(true);
    });

    it("defaults site_summaries to empty when first row missing", async () => {
      const s = newStmt();
      s.first.mockResolvedValue(null);
      const m = mockD1(s);
      const db = m as unknown as D1Database;
      const tools = createAgentTools(db, date);
      const result = await tools.saveFinalReport.execute({
        reportEn: "Report",
        reportZh: "报告",
      }, execOpts);
      expect(result.success).toBe(true);
    });
  });
});
