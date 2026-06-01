import { describe, it, expect } from "vitest";
import { getTodayDateString, getYesterdayDateString } from "./date";

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
