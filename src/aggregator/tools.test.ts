import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolExecutionOptions } from "ai";
import { createAgentTools, createInMemoryAgentTools } from "./tools";
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

const date = "2026-06-01";

beforeEach(() => {
  vi.clearAllMocks();
});

const arcCandidate = {
  title: "Arc Browser",
  thumbnail: "https://thumbs.example.com/arc.jpg",
  image: "https://example.com/arc.jpg",
  sourceUrl: "https://arc.net",
};

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

describe("saveSiteSummary with images", () => {
  it("persists images alongside the summary", async () => {
    const s = newStmt();
    s.first.mockResolvedValue(null);
    const m = mockD1(s);
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);
    await tools.saveSiteSummary.execute({
      website: "producthunt",
      summaryEn: "PH EN",
      summaryZh: "PH ZH",
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

  it("omits the images key when no images are provided", async () => {
    const s = newStmt();
    s.first.mockResolvedValue(null);
    const m = mockD1(s);
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);
    await tools.saveSiteSummary.execute({
      website: "github",
      summaryEn: "GH EN",
      summaryZh: "GH ZH",
    }, execOpts);

    const jsonArg = s.bind.mock.calls
      .flat()
      .find((a) => typeof a === "string" && a.includes('"github"'));
    const parsed = JSON.parse(jsonArg as string);
    expect(parsed.github.images).toBeUndefined();
  });
});

describe("searchImages tool", () => {
  it("returns selected images for each item", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);

    vi.mocked(searchImages).mockResolvedValue([arcCandidate]);
    vi.mocked(selectBestImage).mockResolvedValue(arcCandidate);

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }, { name: "Cursor" }] },
      execOpts
    );

    expect(result.images).toEqual([
      { name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" },
      { name: "Cursor", url: "https://thumbs.example.com/arc.jpg" },
    ]);
    expect(result.totalFound).toBe(2);
    expect(selectBestImage).toHaveBeenCalledTimes(2);
    expect(selectBestImage).toHaveBeenNthCalledWith(
      1,
      null,
      "Arc Browser",
      expect.any(Array)
    );
  });

  it("uses the item's own image from the scraped data", async () => {
    const s = newStmt();
    s.all.mockResolvedValue({
      results: [
        { raw_data: JSON.stringify([{ name: "Arc Browser", link: "https://ph.example.com/arc" }]) },
      ],
    });
    const m = mockD1(s);
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);

    vi.mocked(resolveItemImage).mockResolvedValue("https://own.example.com/arc.jpg");

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }] },
      execOpts
    );

    expect(resolveItemImage).toHaveBeenCalledWith("https://ph.example.com/arc");
    expect(result.images).toEqual([
      { name: "Arc Browser", url: "https://own.example.com/arc.jpg" },
    ]);
    expect(selectBestImage).not.toHaveBeenCalled();
    expect(searchImages).not.toHaveBeenCalled();
  });

  it("falls back to engine search when the item has no own image", async () => {
    const s = newStmt();
    s.all.mockResolvedValue({
      results: [{ raw_data: JSON.stringify([{ name: "Arc Browser", link: "https://ph.example.com/arc" }]) }],
    });
    const m = mockD1(s);
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);

    vi.mocked(resolveItemImage).mockResolvedValue(null);
    vi.mocked(searchImages).mockResolvedValue([arcCandidate]);
    vi.mocked(selectBestImage).mockResolvedValue(arcCandidate);

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }] },
      execOpts
    );

    expect(resolveItemImage).toHaveBeenCalledWith("https://ph.example.com/arc");
    expect(selectBestImage).toHaveBeenCalledTimes(1);
    expect(result.images).toEqual([
      { name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" },
    ]);
  });

  it("passes the vision model through to selection", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const fakeModel = { modelId: "vision" } as never;
    const tools = createAgentTools(db, date, fakeModel);

    vi.mocked(searchImages).mockResolvedValue([arcCandidate]);
    vi.mocked(selectBestImage).mockResolvedValue(arcCandidate);

    await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }] },
      execOpts
    );
    expect(selectBestImage).toHaveBeenCalledWith(
      fakeModel,
      "Arc Browser",
      expect.any(Array)
    );
  });

  it("omits items with no usable image", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);

    vi.mocked(searchImages).mockResolvedValue([]);
    vi.mocked(selectBestImage).mockResolvedValue(null);

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Nope" }] },
      execOpts
    );
    expect(result.images).toEqual([]);
    expect(result.totalFound).toBe(0);
  });

  it("does not throw when image search fails", async () => {
    const m = mockD1();
    const db = m as unknown as D1Database;
    const tools = createAgentTools(db, date);

    vi.mocked(searchImages).mockRejectedValueOnce(new Error("ddg down"));

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc" }] },
      execOpts
    );
    expect(result.images).toEqual([]);
  });
});

describe("createInMemoryAgentTools", () => {
  it("keeps images in site summary results", async () => {
    const { tools, getResults } = createInMemoryAgentTools(date, {});
    await tools.saveSiteSummary.execute({
      website: "github",
      summaryEn: "GH EN",
      summaryZh: "GH ZH",
      images: [{ name: "repo", url: "https://thumbs.example.com/r.jpg" }],
    }, execOpts);

    expect(getResults().siteSummaries.github.images).toEqual([
      { name: "repo", url: "https://thumbs.example.com/r.jpg" },
    ]);
  });

  it("exposes a searchImages tool", async () => {
    const { tools } = createInMemoryAgentTools(date, {});
    vi.mocked(searchImages).mockResolvedValue([arcCandidate]);
    vi.mocked(selectBestImage).mockResolvedValue(arcCandidate);

    const result = await tools.searchImages.execute(
      { website: "producthunt", items: [{ name: "Arc Browser" }] },
      execOpts
    );
    expect(result.images).toHaveLength(1);
  });

  it("resolves the item URL from the in-memory raw data", async () => {
    const { tools } = createInMemoryAgentTools(date, {
      producthunt: [{ name: "Arc Browser", link: "https://ph.example.com/arc" }],
    });
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
