import { describe, it, expect, vi } from "vitest";
import type { ToolExecutionOptions } from "ai";
import { createAgentTools } from "./tools";

vi.mock("./search", () => ({
  searchWeb: vi.fn(),
}));

import { searchWeb } from "./search";

const execOpts = {} as ToolExecutionOptions;

function newStmt() {
  const s = {
    bind: vi.fn(),
    run: vi.fn(),
    first: vi.fn(),
    all: vi.fn(),
  };
  s.bind.mockReturnValue(s);
  s.run.mockResolvedValue({ success: true });
  s.first.mockResolvedValue(null);
  s.all.mockResolvedValue({ results: [] });
  return s;
}

function mockD1(stmt?: ReturnType<typeof newStmt>) {
  const s = stmt ?? newStmt();
  return {
    prepare: vi.fn().mockReturnValue(s),
    batch: vi.fn().mockResolvedValue([]),
    _stmt: s,
  };
}

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
