import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("./llm", () => ({
  createDeepSeekModel: vi.fn(() => ({})),
}));

vi.mock("./tools", () => ({
  createAgentTools: vi.fn(() => ({
    getRawDataByWebsite: {},
    webSearch: {},
    saveSiteSummary: {},
    saveFinalReport: {},
  })),
}));

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: vi.fn(() => ({
    start: vi.fn(),
    startAndWaitForPorts: vi.fn(),
    fetch: vi.fn(),
    containerFetch: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    getState: vi.fn(),
    renewActivityTimeout: vi.fn(),
    schedule: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onError: vi.fn(),
  })),
  ContainerProxy: class {},
  getRandom: vi.fn(),
  switchPort: vi.fn(),
}));

import { generateText } from "ai";
import { runAggregation, ensureCompleteSummary, MAX_STEPS } from "./aggregate";

function mockD1() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue({
      site_summaries: JSON.stringify({
        producthunt: { en: "PH EN", zh: "PH ZH" },
        hackernews: { en: "HN EN", zh: "HN ZH" },
        github: { en: "GH EN", zh: "GH ZH" },
        googletrends: { en: "GT EN", zh: "GT ZH" },
      }),
      full_report_en: "report en",
      full_report_zh: "report zh",
    }),
  };
  stmt.bind.mockImplementation(() => stmt);
  return {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as D1Database;
}

function mockD1With(summary: unknown) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(summary),
  };
  stmt.bind.mockImplementation(() => stmt);
  return {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as D1Database;
}

describe("runAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateText with correct model and tools", async () => {
    const db = mockD1();
    await runAggregation(db, "sk-test-key", "2026-06-01");

    expect(generateText).toHaveBeenCalledTimes(1);
    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(callArgs.system).toBeTruthy();
    expect(callArgs.tools).toBeTruthy();
    expect(callArgs.maxSteps).toBe(MAX_STEPS);
  });

  it("passes DeepSeek API key to model creation", async () => {
    const { createDeepSeekModel } = await import("./llm");
    const db = mockD1();
    await runAggregation(db, "sk-my-key", "2026-06-01");

    expect(createDeepSeekModel).toHaveBeenCalledWith("sk-my-key");
  });

  it("creates agent tools with correct date", async () => {
    const { createAgentTools } = await import("./tools");
    const db = mockD1();
    await runAggregation(db, "sk-key", "2026-06-01");

    expect(createAgentTools).toHaveBeenCalledWith(db, "2026-06-01");
  });

  it("has a static system prompt", async () => {
    const db = mockD1();
    await runAggregation(db, "sk-key", "2026-06-01");

    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(callArgs.system).toContain("producthunt");
    expect(callArgs.system).toContain("hackernews");
    expect(callArgs.system).toContain("github");
    expect(callArgs.system).toContain("googletrends");
    expect(callArgs.system).toContain("googleSuggest");
    expect(callArgs.system).toContain("English");
    expect(callArgs.system).toContain("Chinese");
    expect(callArgs.system).toContain("webSearch");
    expect(callArgs.system).toContain("up to 10");
    expect(callArgs.system).toContain("400-600");
    expect(callArgs.system).toContain("1500-3000");
    expect(callArgs.system).toContain("[Category]");
    expect(callArgs.system).toContain("sports");
    expect(callArgs.system).toContain("pain points");
    expect(callArgs.system).toContain("non-technical");
  });

  it("uses prompt instructing bilingual output", async () => {
    const db = mockD1();
    await runAggregation(db, "sk-key", "2026-06-01");

    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(callArgs.prompt).toContain("English");
    expect(callArgs.prompt).toContain("Chinese");
    expect(callArgs.prompt).toContain("bilingual");
  });

  it("gives the agent enough steps for 4 sites plus web research", () => {
    expect(MAX_STEPS).toBeGreaterThanOrEqual(30);
  });

  it("throws when the summary is still incomplete after the agent loop", async () => {
    const db = mockD1With(null);

    await expect(runAggregation(db, "sk-key", "2026-06-01")).rejects.toThrow(
      /incomplete/i
    );
  });
});

describe("ensureCompleteSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const model = {} as unknown as Parameters<typeof ensureCompleteSummary>[1];
  const allFour = {
    producthunt: { en: "PH EN", zh: "PH ZH" },
    hackernews: { en: "HN EN", zh: "HN ZH" },
    github: { en: "GH EN", zh: "GH ZH" },
    googletrends: { en: "GT EN", zh: "GT ZH" },
  };

  it("reports complete when all 4 sites and the report exist", async () => {
    const db = mockD1With({
      site_summaries: JSON.stringify(allFour),
      full_report_en: "report en",
      full_report_zh: "report zh",
    });

    const status = await ensureCompleteSummary(db, model, "2026-06-01");

    expect(status.complete).toBe(true);
    expect(status.missingSites).toEqual([]);
    expect(status.missingReport).toBe(false);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("reports the specific missing site", async () => {
    const { googletrends: _omitted, ...threeSites } = allFour;
    const db = mockD1With({
      site_summaries: JSON.stringify(threeSites),
      full_report_en: "report en",
      full_report_zh: "report zh",
    });

    const status = await ensureCompleteSummary(db, model, "2026-06-01");

    expect(status.complete).toBe(false);
    expect(status.missingSites).toEqual(["googletrends"]);
    expect(status.missingReport).toBe(false);
  });

  it("reports a missing final report", async () => {
    const db = mockD1With({
      site_summaries: JSON.stringify(allFour),
      full_report_en: "",
      full_report_zh: "",
    });

    const status = await ensureCompleteSummary(db, model, "2026-06-01");

    expect(status.complete).toBe(false);
    expect(status.missingSites).toEqual([]);
    expect(status.missingReport).toBe(true);
  });

  it("reports all sites missing when no summary row exists", async () => {
    const db = mockD1With(null);

    const status = await ensureCompleteSummary(db, model, "2026-06-01");

    expect(status.complete).toBe(false);
    expect(status.missingSites).toEqual([
      "producthunt",
      "hackernews",
      "github",
      "googletrends",
    ]);
    expect(status.missingReport).toBe(true);
  });
});
