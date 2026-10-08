import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import api from "./api";
import { getTodayDateString } from "../utils/date";

vi.mock("../db/client", () => ({
  subscribeEmail: vi.fn(),
  getHomeTimeline: vi.fn().mockResolvedValue({ results: [] }),
}));

vi.mock("../notifier/email", () => ({
  sendDailyEmail: vi.fn(),
  sendWeeklyEmail: vi.fn(),
}));

function makeApp() {
  const app = new Hono();
  app.route("/", api);
  return app;
}

function makeEnv() {
  return {
    DB: {},
    SCRAPE_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
    EMAIL: { send: vi.fn() },
    INTERNAL_SECRET: "test-secret",
  };
}

describe("POST /internal/aggregate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without the internal secret", async () => {
    const env = makeEnv();
    const res = await makeApp().request(
      "/internal/aggregate",
      { method: "POST" },
      env as never
    );

    expect(res.status).toBe(401);
    expect(env.SCRAPE_QUEUE.send).not.toHaveBeenCalled();
  });

  it("enqueues an aggregate message for an explicit date", async () => {
    const env = makeEnv();
    const res = await makeApp().request(
      "/internal/aggregate",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: "2026-10-07" }),
      },
      env as never
    );

    expect(res.status).toBe(200);
    expect(env.SCRAPE_QUEUE.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "manual_2026-10-07_daily",
        scheduled_date: "2026-10-07",
        type: "manual-daily",
      })
    );
  });

  it("defaults to today when no date is provided", async () => {
    const env = makeEnv();
    const res = await makeApp().request(
      "/internal/aggregate",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      },
      env as never
    );

    expect(res.status).toBe(200);
    expect(env.SCRAPE_QUEUE.send).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_date: getTodayDateString() })
    );
  });

  it("defaults to today when the date is malformed", async () => {
    const env = makeEnv();
    const res = await makeApp().request(
      "/internal/aggregate",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: "not-a-date" }),
      },
      env as never
    );

    expect(res.status).toBe(200);
    expect(env.SCRAPE_QUEUE.send).toHaveBeenCalledWith(
      expect.objectContaining({ scheduled_date: getTodayDateString() })
    );
  });
});
