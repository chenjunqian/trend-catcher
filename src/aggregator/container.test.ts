import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@cloudflare/containers", () => ({
  getContainer: vi.fn(),
}));

vi.mock("../notifier/email", () => ({
  sendDailyEmail: vi.fn(),
  sendWeeklyEmail: vi.fn(),
}));

import { getContainer } from "@cloudflare/containers";
import { triggerWeeklyContainerAggregation } from "./container";
import { mockD1, newStmt } from "../test-utils/d1-mock";
import { sendWeeklyEmail } from "../notifier/email";
import type { EmailSender } from "../notifier/email";

function mockEmailSender(): EmailSender {
  return {
    send: vi.fn().mockResolvedValue({ messageId: "mock-id" }),
  };
}

function mockContainerResponse(ok: boolean, body: unknown) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    status: ok ? 200 : 500,
  };
}

describe("triggerWeeklyContainerAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const weekStartDate = "2026-06-01";
  const deepseekApiKey = "sk-test";
  const emailSender = mockEmailSender();

  it("skips aggregation when no daily summaries exist", async () => {
    const s = newStmt();
    s.all.mockResolvedValue({ results: [] });
    const m = mockD1(s);
    const db = m as unknown as D1Database;

    const containerBinding = {};
    const stub = { fetch: vi.fn() };
    vi.mocked(getContainer).mockReturnValue(stub as any);

    await triggerWeeklyContainerAggregation(
      db, containerBinding, emailSender, weekStartDate, deepseekApiKey
    );

    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it("sends correct request to container with daily summaries", async () => {
    const s = newStmt();
    s.all.mockResolvedValue({
      results: [
        {
          summary_date: "2026-06-01",
          full_report_en: "Report EN 1",
          full_report_zh: "Report ZH 1",
          site_summaries: JSON.stringify({ producthunt: { en: "PH", zh: "PH_Z" } }),
        },
        {
          summary_date: "2026-06-02",
          full_report_en: "Report EN 2",
          full_report_zh: "Report ZH 2",
          site_summaries: JSON.stringify({ hackernews: { en: "HN", zh: "HN_Z" } }),
        },
      ],
    });
    const m = mockD1(s);
    const db = m as unknown as D1Database;

    const containerBinding = {};
    const stub = { fetch: vi.fn() };
    stub.fetch.mockResolvedValue(mockContainerResponse(true, {
      success: true,
      siteSummaries: { producthunt: { en: "PH W", zh: "PH W" } },
      reportEn: "Weekly EN",
      reportZh: "Weekly ZH",
    }));
    vi.mocked(getContainer).mockReturnValue(stub as any);

    await triggerWeeklyContainerAggregation(
      db, containerBinding, emailSender, weekStartDate, deepseekApiKey
    );

    expect(stub.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = vi.mocked(stub.fetch).mock.calls[0][0] as Request;
    expect(fetchCall.url).toBe("http://container/aggregate-weekly");

    const body = JSON.parse(await fetchCall.text());
    expect(body.weekStartDate).toBe(weekStartDate);
    expect(body.dailySummaries).toHaveLength(2);
    expect(body.apiKey).toBe(deepseekApiKey);
  });

  it("retries on container fetch failure", async () => {
    vi.useFakeTimers();

    const s = newStmt();
    s.all.mockResolvedValue({
      results: [{
        summary_date: "2026-06-01",
        full_report_en: "R",
        full_report_zh: "R",
        site_summaries: "{}",
      }],
    });
    const m = mockD1(s);
    const db = m as unknown as D1Database;

    const containerBinding = {};
    const stub = { fetch: vi.fn() };

    // First 2 calls fail, 3rd succeeds
    stub.fetch
      .mockRejectedValueOnce(new Error("Connection refused"))
      .mockRejectedValueOnce(new Error("Connection refused"))
      .mockResolvedValue(mockContainerResponse(true, {
        success: true,
        siteSummaries: {},
        reportEn: "OK",
        reportZh: "OK",
      }));

    vi.mocked(getContainer).mockReturnValue(stub as any);

    const promise = triggerWeeklyContainerAggregation(
      db, containerBinding, emailSender, weekStartDate, deepseekApiKey
    );

    // Run immediate attempt (attempt 0)
    await vi.advanceTimersToNextTimerAsync();
    // Advance through retry delays
    await vi.advanceTimersByTimeAsync(2000); // delay for attempt 1
    await vi.advanceTimersByTimeAsync(4000); // delay for attempt 2

    await expect(promise).resolves.toBeUndefined();
    expect(stub.fetch).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("throws after all retries exhausted", async () => {
    vi.useFakeTimers();

    const s = newStmt();
    s.all.mockResolvedValue({
      results: [{
        summary_date: "2026-06-01",
        full_report_en: "R",
        full_report_zh: "R",
        site_summaries: "{}",
      }],
    });
    const m = mockD1(s);
    const db = m as unknown as D1Database;

    const containerBinding = {};
    const stub = { fetch: vi.fn() };
    stub.fetch.mockRejectedValue(new Error("Boom"));
    vi.mocked(getContainer).mockReturnValue(stub as any);

    const promise = triggerWeeklyContainerAggregation(
      db, containerBinding, emailSender, weekStartDate, deepseekApiKey
    );

    // Catch early to avoid unhandled rejection during timer advancement
    const rejection = promise.catch((e) => e);

    await vi.runAllTimersAsync();

    const err = await rejection;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("aggregation failed after retries");

    vi.useRealTimers();
  });

  it("saves result to D1 and sends email on success", async () => {
    const s = newStmt();
    s.all.mockResolvedValue({
      results: [{
        summary_date: "2026-06-01",
        full_report_en: "R",
        full_report_zh: "R",
        site_summaries: "{}",
      }],
    });
    const m = mockD1(s);
    const db = m as unknown as D1Database;

    const containerBinding = {};
    const stub = { fetch: vi.fn() };
    stub.fetch.mockResolvedValue(mockContainerResponse(true, {
      success: true,
      siteSummaries: { producthunt: { en: "PH W", zh: "PH W" } },
      reportEn: "Weekly final EN",
      reportZh: "Weekly final ZH",
    }));
    vi.mocked(getContainer).mockReturnValue(stub as any);

    await triggerWeeklyContainerAggregation(
      db, containerBinding, emailSender, weekStartDate, deepseekApiKey
    );

    expect(m.prepare).toHaveBeenCalled();
    const prepareCalls = vi.mocked(m.prepare).mock.calls;
    const weeklyCall = prepareCalls.find(([sql]) => (sql as string).includes("weekly_summaries"));
    expect(weeklyCall).toBeTruthy();

    expect(sendWeeklyEmail).toHaveBeenCalledWith(
      db, emailSender, weekStartDate, "https://trendcatcher.guoshaotech.com"
    );
  });
});
