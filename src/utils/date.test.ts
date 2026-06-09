import { describe, it, expect } from "vitest";
import { getTodayDateString, getYesterdayDateString, getLastWeekMonday, getDateRangeForWeek } from "./date";

describe("getTodayDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = getTodayDateString();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a valid calendar date", () => {
    const date = getTodayDateString();
    const parsed = new Date(date + "T00:00:00Z");
    expect(parsed.toString()).not.toBe("Invalid Date");
  });

  it("month is between 01 and 12", () => {
    const date = getTodayDateString();
    const month = parseInt(date.split("-")[1], 10);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it("day is between 01 and 31", () => {
    const date = getTodayDateString();
    const day = parseInt(date.split("-")[2], 10);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });
});

describe("getYesterdayDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = getYesterdayDateString();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is different from today", () => {
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    expect(yesterday).not.toBe(today);
  });
});

describe("getLastWeekMonday", () => {
  it("returns YYYY-MM-DD format", () => {
    const date = getLastWeekMonday();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a valid calendar date", () => {
    const date = getLastWeekMonday();
    const parsed = new Date(date + "T00:00:00Z");
    expect(parsed.toString()).not.toBe("Invalid Date");
  });

  it("returns a Monday (ISO weekday 1)", () => {
    const date = getLastWeekMonday();
    const d = new Date(date + "T00:00:00Z");
    expect(d.getUTCDay()).toBe(1);
  });

  it("returns a date in the past (at least 1 day ago)", () => {
    const date = getLastWeekMonday();
    const today = new Date(getTodayDateString() + "T00:00:00Z");
    const monday = new Date(date + "T00:00:00Z");
    expect(monday.getTime()).toBeLessThan(today.getTime());
  });
});

describe("getDateRangeForWeek", () => {
  it("returns 7 dates", () => {
    const dates = getDateRangeForWeek("2026-06-01");
    expect(dates).toHaveLength(7);
  });

  it("returns sequential dates starting from Monday", () => {
    const dates = getDateRangeForWeek("2026-06-01");
    expect(dates[0]).toBe("2026-06-01");
    expect(dates[1]).toBe("2026-06-02");
    expect(dates[2]).toBe("2026-06-03");
    expect(dates[3]).toBe("2026-06-04");
    expect(dates[4]).toBe("2026-06-05");
    expect(dates[5]).toBe("2026-06-06");
    expect(dates[6]).toBe("2026-06-07");
  });

  it("all dates are valid", () => {
    const dates = getDateRangeForWeek("2026-06-01");
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(date + "T00:00:00Z");
      expect(parsed.toString()).not.toBe("Invalid Date");
    }
  });

  it("last date is 6 days after first (Monday to Sunday)", () => {
    const dates = getDateRangeForWeek("2026-01-05");
    const first = new Date(dates[0] + "T00:00:00Z");
    const last = new Date(dates[6] + "T00:00:00Z");
    const diffMs = last.getTime() - first.getTime();
    expect(diffMs).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it("handles month boundaries correctly", () => {
    const dates = getDateRangeForWeek("2026-01-26");
    expect(dates[5]).toBe("2026-01-31");
    expect(dates[6]).toBe("2026-02-01");
  });
});
