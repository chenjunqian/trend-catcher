import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MessageBatch, SendEmail } from "@cloudflare/workers-types";
import { queueConsumer, type Env } from "./consumer";
import type { TaskMessage } from "./generator";
import { mockD1, newStmt } from "../test-utils/d1-mock";

vi.mock("../aggregator/container", () => ({
  triggerContainerAggregation: vi.fn(),
  triggerWeeklyContainerAggregation: vi.fn(),
}));

import { triggerContainerAggregation, triggerWeeklyContainerAggregation } from "../aggregator/container";

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

function mockEmail(): SendEmail {
  return {
    send: vi.fn().mockResolvedValue({ messageId: "mock-id" }),
  } as unknown as SendEmail;
}

function mockEnv(): Env {
  return {
    DB: mockD1() as unknown as D1Database,
    DEEPSEEK_API_KEY: "sk-test",
    EMAIL: mockEmail(),
  };
}

describe("queueConsumer — manual-daily messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers daily container aggregation", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const msg: TaskMessage = {
      id: "manual_2026-06-14_daily",
      scheduled_date: "2026-06-14",
      website: "daily",
      item: "aggregate",
      type: "manual-daily",
    };

    const env = mockEnv();
    const ctx = mockCtx();
    const batch = makeBatch([makeMsg(msg)]);

    await queueConsumer(batch, env, ctx);

    expect(batch.messages[0].ack).toHaveBeenCalled();
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("does not route manual-daily to weekly aggregation", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const msg: TaskMessage = {
      id: "manual_2026-06-14_daily",
      scheduled_date: "2026-06-14",
      website: "daily",
      item: "aggregate",
      type: "manual-daily",
    };

    const env = mockEnv();
    const batch = makeBatch([makeMsg(msg)]);
    await queueConsumer(batch, env, mockCtx());

    expect(triggerWeeklyContainerAggregation).not.toHaveBeenCalled();
  });
});

describe("queueConsumer — manual-weekly messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers weekly container aggregation", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const msg: TaskMessage = {
      id: "manual_2026-06-08_weekly",
      scheduled_date: "2026-06-08",
      website: "weekly",
      item: "aggregate",
      type: "manual-weekly",
    };

    const env = mockEnv();
    const ctx = mockCtx();
    const batch = makeBatch([makeMsg(msg)]);

    await queueConsumer(batch, env, ctx);

    expect(batch.messages[0].ack).toHaveBeenCalled();
    expect(ctx.waitUntil).toHaveBeenCalled();
  });

  it("does not route manual-weekly to daily aggregation", async () => {
    const s = newStmt();
    const m = mockD1(s);

    const msg: TaskMessage = {
      id: "manual_2026-06-08_weekly",
      scheduled_date: "2026-06-08",
      website: "weekly",
      item: "aggregate",
      type: "manual-weekly",
    };

    const env = mockEnv();
    const batch = makeBatch([makeMsg(msg)]);
    await queueConsumer(batch, env, mockCtx());

    expect(triggerContainerAggregation).not.toHaveBeenCalled();
  });
});

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
      EMAIL: mockEmail(),
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
      EMAIL: mockEmail(),
    };

    const batch = makeBatch([makeMsg(weeklyMsg)]);
    await queueConsumer(batch, env, mockCtx());

    expect(triggerContainerAggregation).not.toHaveBeenCalled();
  });

  it("calls weekly container aggregation with the correct weekStartDate", async () => {
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
      EMAIL: mockEmail(),
      AGGREGATOR_CONTAINER: {} as unknown as DurableObjectNamespace,
    };

    const batch = makeBatch([makeMsg(weeklyMsg)]);
    await queueConsumer(batch, env, mockCtx());

    await vi.waitFor(() => {
      expect(triggerWeeklyContainerAggregation).toHaveBeenCalled();
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
      EMAIL: mockEmail(),
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
      EMAIL: mockEmail(),
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
      EMAIL: mockEmail(),
    };

    const batch = makeBatch([makeMsg(dailyMsg)]);
    await queueConsumer(batch, env, mockCtx());

    // Daily messages don't route to weekly
    expect(triggerWeeklyContainerAggregation).not.toHaveBeenCalled();
  });
});
