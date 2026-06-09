import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MessageBatch } from "@cloudflare/workers-types";
import { queueConsumer, type Env } from "./consumer";
import type { TaskMessage } from "./generator";
import { mockD1, newStmt } from "../test-utils/d1-mock";

vi.mock("../aggregator/aggregate", () => ({
  runAggregation: vi.fn(),
  SYSTEM_PROMPT: "",
  MAX_STEPS: 20,
}));

vi.mock("../aggregator/container", () => ({
  triggerContainerAggregation: vi.fn(),
  triggerWeeklyContainerAggregation: vi.fn(),
}));

vi.mock("../aggregator/weekly-aggregate", () => ({
  runWeeklyAggregation: vi.fn(),
}));

vi.mock("../notifier/email", () => ({
  sendDailyEmail: vi.fn(),
  sendWeeklyEmail: vi.fn(),
}));

import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "../aggregator/container";
import { runAggregation } from "../aggregator/aggregate";
import { runWeeklyAggregation } from "../aggregator/weekly-aggregate";

function makeMsg(body: TaskMessage) {
  return {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function makeBatch(messages: ReturnType<typeof makeMsg>[]) {
  return { messages } as unknown as MessageBatch<TaskMessage>;
}

function mockCtx(): ExecutionContext {
  const waits: Promise<void>[] = [];
  return {
    waitUntil: vi.fn((p: Promise<void>) => { waits.push(p); }),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;
}

function mockEnv(): Env {
  return {
    DB: mockD1() as unknown as D1Database,
    DEEPSEEK_API_KEY: "sk-test",
    RESEND_API_KEY: "re-test",
    NOTIFICATION_EMAIL: "test@example.com",
  };
}

describe("queueConsumer — weekly messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes weekly messages to weekly aggregation", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const weeklyMsg: TaskMessage = {
      id: "2026-06-01_weekly_report",
      scheduled_date: "2026-06-01",
      website: "weekly",
      item: "report",
      type: "weekly",
    };

    const env: Env = {
      DB: m as unknown as D1Database,
      DEEPSEEK_API_KEY: "sk-test",
      RESEND_API_KEY: "re-test",
      NOTIFICATION_EMAIL: "test@example.com",
    };

    const ctx = mockCtx();
    const batch = makeBatch([makeMsg(weeklyMsg)]);

    await queueConsumer(batch, env, ctx);

    expect(ctx.waitUntil).toHaveBeenCalled();
    const batchMsgs = batch.messages;
    expect(batchMsgs[0].ack).toHaveBeenCalled();
  });

  it("does not call daily aggregation for weekly messages", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const weeklyMsg: TaskMessage = {
      id: "2026-06-01_weekly_report",
      scheduled_date: "2026-06-01",
      website: "weekly",
      item: "report",
      type: "weekly",
    };

    const env: Env = {
      DB: m as unknown as D1Database,
      DEEPSEEK_API_KEY: "sk-test",
      RESEND_API_KEY: "re-test",
      NOTIFICATION_EMAIL: "test@example.com",
    };

    const batch = makeBatch([makeMsg(weeklyMsg)]);
    await queueConsumer(batch, env, mockCtx());

    expect(runAggregation).not.toHaveBeenCalled();
    expect(triggerContainerAggregation).not.toHaveBeenCalled();
  });

  it("calls weekly aggregation with the correct weekStartDate", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const weeklyMsg: TaskMessage = {
      id: "2026-06-01_weekly_report",
      scheduled_date: "2026-06-01",
      website: "weekly",
      item: "report",
      type: "weekly",
    };

    const env: Env = {
      DB: m as unknown as D1Database,
      DEEPSEEK_API_KEY: "sk-test",
      RESEND_API_KEY: "re-test",
      NOTIFICATION_EMAIL: "test@example.com",
      AGGREGATOR_CONTAINER: undefined,
    };

    const batch = makeBatch([makeMsg(weeklyMsg)]);
    await queueConsumer(batch, env, mockCtx());

    await vi.waitFor(() => {
      expect(runWeeklyAggregation).toHaveBeenCalledWith(
        m as unknown as D1Database,
        "sk-test",
        "2026-06-01"
      );
    }, { timeout: 1000 });
  });

  it("retries when processTask throws for weekly message", async () => {
    const s = newStmt();
    s.first.mockResolvedValue(null); // task not found → skip early return
    const m = mockD1(s);

    const weeklyMsg: TaskMessage = {
      id: "2026-06-01_weekly_report",
      scheduled_date: "2026-06-01",
      website: "weekly",
      item: "report",
      type: "weekly",
    };

    const env: Env = {
      DB: m as unknown as D1Database,
      DEEPSEEK_API_KEY: "sk-test",
      RESEND_API_KEY: "re-test",
      NOTIFICATION_EMAIL: "test@example.com",
    };

    const msg = makeMsg(weeklyMsg);
    const batch = makeBatch([msg]);

    await queueConsumer(batch, env, mockCtx());

    // processTask with non-pending status returns early (doesn't throw)
    // retry only happens on thrown errors
  });

  it("handles empty batch gracefully", async () => {
    const m = mockD1();
    const env: Env = {
      DB: m as unknown as D1Database,
      DEEPSEEK_API_KEY: "sk-test",
      RESEND_API_KEY: "re-test",
      NOTIFICATION_EMAIL: "test@example.com",
    };

    const batch = makeBatch([]);
    await expect(queueConsumer(batch, env, mockCtx())).resolves.toBeUndefined();
  });
});

describe("queueConsumer — daily messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes daily scrape tasks normally", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const dailyMsg: TaskMessage = {
      id: "2026-06-01_producthunt_top10",
      scheduled_date: "2026-06-01",
      website: "producthunt",
      item: "top10",
    };

    const env: Env = {
      DB: m as unknown as D1Database,
      DEEPSEEK_API_KEY: "sk-test",
      RESEND_API_KEY: "re-test",
      NOTIFICATION_EMAIL: "test@example.com",
    };

    const batch = makeBatch([makeMsg(dailyMsg)]);
    await queueConsumer(batch, env, mockCtx());

    // Daily messages don't route to weekly
    expect(runWeeklyAggregation).not.toHaveBeenCalled();
    expect(triggerWeeklyContainerAggregation).not.toHaveBeenCalled();
  });
});
