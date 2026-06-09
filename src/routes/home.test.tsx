/** @jsxImportSource hono/jsx */
import { describe, it, expect } from "vitest";
import Home from "./home";

describe("Home — mixed daily + weekly", () => {
  const dailySummaries = [
    {
      summary_date: "2026-06-06",
      full_report_en: "## Saturday Report\nSome content here for Saturday",
      full_report_zh: "## 周六报告",
      created_at: 1000,
    },
    {
      summary_date: "2026-06-05",
      full_report_en: "## Friday Report",
      full_report_zh: "## 周五报告",
      created_at: 500,
    },
  ];

  const weeklySummaries = [
    {
      week_start_date: "2026-06-01",
      full_report_en: "## Weekly Report\nWeekly overview content",
      full_report_zh: "## 周报",
      created_at: 750,
    },
  ];

  function render(props: Partial<Parameters<typeof Home>[0]> = {}) {
    const html = (
      <Home
        dailySummaries={props.dailySummaries ?? dailySummaries}
        weeklySummaries={props.weeklySummaries ?? weeklySummaries}
        lang={props.lang ?? "en"}
        path={props.path ?? "/"}
      />
    );
    return String(html);
  }

  it("renders a heading", () => {
    const html = render();
    expect(html).toContain("Daily Trend Reports");
  });

  it("shows weekly badge for weekly items", () => {
    const html = render();
    expect(html).toContain("Weekly");
  });

  it("shows daily badge for daily items", () => {
    const html = render();
    expect(html).toContain("Daily");
  });

  it("links weekly items to /reports/weekly/:date", () => {
    const html = render();
    expect(html).toContain('href="/reports/weekly/2026-06-01');
  });

  it("links daily items to /reports/:date", () => {
    const html = render();
    expect(html).toContain('href="/reports/2026-06-06');
  });

  it("sorts items by created_at descending", () => {
    const html = render();
    // 1000 (daily 06-06) > 750 (weekly 06-01) > 500 (daily 06-05)
    const idx0606 = html.indexOf("2026-06-06");
    const idx0601 = html.indexOf("2026-06-01");
    const idx0605 = html.indexOf("2026-06-05");
    expect(idx0606).toBeLessThan(idx0601);
    expect(idx0601).toBeLessThan(idx0605);
  });

  it("shows empty state when both arrays are empty", () => {
    const html = render({ dailySummaries: [], weeklySummaries: [] });
    expect(html).toContain("No reports yet");
  });

  it("renders with Chinese locale", () => {
    const html = render({ lang: "zh" });
    expect(html).toContain("周报");
    expect(html).toContain("日报");
  });

  it("renders markdown preview stripped", () => {
    const html = render();
    // stripMarkdownPreview removes ## headings and turns content to plain text
    expect(html).toContain("Saturday Report");
  });
});
