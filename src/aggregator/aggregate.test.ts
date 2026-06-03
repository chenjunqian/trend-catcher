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

import { generateText } from "ai";
import { runAggregation } from "./aggregate";

function mockD1() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({
      site_summaries: JSON.stringify({
        producthunt: { en: "PH EN", zh: "PH ZH" },
        hackernews: { en: "HN EN", zh: "HN ZH" },
        github: { en: "GH EN", zh: "GH ZH" },
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
    expect(callArgs.maxSteps).toBe(20);
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
    expect(callArgs.system).toContain("English");
    expect(callArgs.system).toContain("Chinese");
    expect(callArgs.system).toContain("webSearch");
    expect(callArgs.system).toContain("up to 10");
    expect(callArgs.system).toContain("400-600");
    expect(callArgs.system).toContain("1500-3000");
    expect(callArgs.system).toContain("[Category]");
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
});
