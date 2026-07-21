import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("./llm", () => ({
  createDeepSeekModel: vi.fn(() => ({})),
}));

vi.mock("./tools", () => ({
  createWeeklyAgentTools: vi.fn(() => ({
    getDailySummaries: {},
    webSearch: {},
    saveSiteSummary: {},
    saveFinalReport: {},
  })),
}));

vi.mock("../db/client", () => ({
  getWeeklySummaryByDate: vi.fn().mockResolvedValue({
    site_summaries: JSON.stringify({
      producthunt: { en: "PH", zh: "PH" },
      hackernews: { en: "HN", zh: "HN" },
      github: { en: "GH", zh: "GH" },
    }),
    full_report_en: "report en",
    full_report_zh: "report zh",
  }),
  getDailySummariesForWeek: vi.fn().mockResolvedValue({ results: [] }),
  upsertWeeklySummary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@cloudflare/containers", () => ({
  Container: class {},
  getContainer: vi.fn(() => ({})),
  ContainerProxy: class {},
  getRandom: vi.fn(),
  switchPort: vi.fn(),
}));

import { generateText } from "ai";
import { runWeeklyAggregation, WEEKLY_SYSTEM_PROMPT, WEEKLY_MAX_STEPS } from "./weekly-aggregate";

describe("WEEKLY_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(WEEKLY_SYSTEM_PROMPT).toBeTruthy();
    expect(WEEKLY_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("mentions all three websites", () => {
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Product Hunt");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Hacker News");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("GitHub Trending");
  });

  it("mentions weekly-specific content", () => {
    expect(WEEKLY_SYSTEM_PROMPT).toContain("weekly");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("past week");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("synthesize");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("week's worth of daily");
  });

  it("mentions bilingual requirements", () => {
    expect(WEEKLY_SYSTEM_PROMPT).toContain("English");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Chinese");
  });

  it("mentions section structure", () => {
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Week Overview");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Standout Products");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Cross-Domain Patterns");
    expect(WEEKLY_SYSTEM_PROMPT).toContain("Indie Developer Insights");
  });
});

describe("WEEKLY_MAX_STEPS", () => {
  it("is 20", () => {
    expect(WEEKLY_MAX_STEPS).toBe(20);
  });
});

describe("runWeeklyAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateText with correct model and tools", async () => {
    const db = {} as unknown as D1Database;
    await runWeeklyAggregation(db, "sk-test-key", "2026-06-01");

    expect(generateText).toHaveBeenCalledTimes(1);
    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];

    expect(callArgs.system).toBeTruthy();
    expect(callArgs.tools).toBeTruthy();
    expect(callArgs.maxSteps).toBe(20);
  });

  it("passes DeepSeek API key to model creation", async () => {
    const { createDeepSeekModel } = await import("./llm");
    const db = {} as unknown as D1Database;
    await runWeeklyAggregation(db, "sk-my-key", "2026-06-01");

    expect(createDeepSeekModel).toHaveBeenCalledWith("sk-my-key");
  });

  it("creates weekly agent tools with correct weekStartDate", async () => {
    const { createWeeklyAgentTools } = await import("./tools");
    const db = {} as unknown as D1Database;
    await runWeeklyAggregation(db, "sk-key", "2026-06-01");

    expect(createWeeklyAgentTools).toHaveBeenCalledWith(db, "2026-06-01");
  });

  it("uses the weekly system prompt", async () => {
    const db = {} as unknown as D1Database;
    await runWeeklyAggregation(db, "sk-key", "2026-06-01");

    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.system).toContain("weekly");
    expect(callArgs.system).toContain("synthesize");
  });

  it("uses prompt instructing bilingual output", async () => {
    const db = {} as unknown as D1Database;
    await runWeeklyAggregation(db, "sk-key", "2026-06-01");

    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.prompt).toContain("bilingual");
    expect(callArgs.prompt).toContain("past week");
  });
});
