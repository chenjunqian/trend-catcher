/** @jsxImportSource hono/jsx */
import { describe, it, expect } from "vitest";
import Report from "./report";

const dailySummary = {
  id: 1,
  summary_date: "2026-06-06",
  full_report_en: "## Daily Report\nContent here",
  full_report_zh: "## 日报\n内容",
  site_summaries: JSON.stringify({
    producthunt: { en: "PH summary EN", zh: "PH summary ZH" },
    github: { en: "GH summary EN", zh: "GH summary ZH" },
  }),
  is_notified: 0,
  created_at: 1000,
  updated_at: 1000,
};

const weeklySummary = {
  id: 1,
  week_start_date: "2026-06-01",
  full_report_en: "## Weekly Report\nWeekly content here",
  full_report_zh: "## 周报\n周内容",
  site_summaries: JSON.stringify({
    producthunt: { en: "Weekly PH EN", zh: "Weekly PH ZH" },
  }),
  is_notified: 0,
  created_at: 1000,
  updated_at: 1000,
};

function render(props: Parameters<typeof Report>[0]) {
  return String(<Report {...props} />);
}

describe("Report — daily", () => {
  it("renders daily heading with date", () => {
    const html = render({ summary: dailySummary, lang: "en", path: "/reports/2026-06-06" });
    expect(html).toContain("Daily Trend Report");
    expect(html).toContain("2026-06-06");
  });

  it("renders story headline block", () => {
    const html = render({ summary: dailySummary, lang: "en", path: "/reports/2026-06-06" });
    expect(html).toContain('class="story-head"');
    expect(html).toContain('class="story-title"');
  });

  it("renders site summaries in newspaper columns", () => {
    const html = render({ summary: dailySummary, lang: "en", path: "/reports/2026-06-06" });
    expect(html).toContain('class="columns"');
    expect(html).toContain('class="column"');
  });

  it("shows site summaries section", () => {
    const html = render({ summary: dailySummary, lang: "en", path: "/reports/2026-06-06" });
    expect(html).toContain("Site Summaries");
    expect(html).toContain("Product Hunt");
    expect(html).toContain("GitHub Trending");
  });

  it("renders full report depending on lang", () => {
    const enHtml = render({ summary: dailySummary, lang: "en", path: "/reports/2026-06-06" });
    expect(enHtml).toContain("Daily Report");

    const zhHtml = render({ summary: dailySummary, lang: "zh", path: "/reports/2026-06-06" });
    expect(zhHtml).toContain("日报");
  });

  it("shows empty state when report content is missing", () => {
    const empty = { ...dailySummary, full_report_en: "", full_report_zh: "" };
    const html = render({ summary: empty, lang: "en", path: "/reports/2026-06-06" });
    expect(html).toContain("Report content is empty");
  });
});

describe("Report — weekly", () => {
  it("renders weekly heading with date", () => {
    const html = render({
      summary: weeklySummary as any,
      lang: "en",
      path: "/reports/weekly/2026-06-01",
      isWeekly: true,
    });
    expect(html).toContain("Weekly Trend Report");
    expect(html).toContain("2026-06-01");
  });

  it("renders weekly heading in Chinese", () => {
    const html = render({
      summary: weeklySummary as any,
      lang: "zh",
      path: "/reports/weekly/2026-06-01",
      isWeekly: true,
    });
    expect(html).toContain("每周趋势报告");
  });

  it("shows site summaries for weekly", () => {
    const html = render({
      summary: weeklySummary as any,
      lang: "en",
      path: "/reports/weekly/2026-06-01",
      isWeekly: true,
    });
    expect(html).toContain("Product Hunt");
    expect(html).toContain("Weekly PH EN");
  });

  it("renders full weekly report", () => {
    const html = render({
      summary: weeklySummary as any,
      lang: "en",
      path: "/reports/weekly/2026-06-01",
      isWeekly: true,
    });
    expect(html).toContain("Weekly Report");
  });

  it("has back link", () => {
    const html = render({
      summary: weeklySummary as any,
      lang: "en",
      path: "/reports/weekly/2026-06-01",
      isWeekly: true,
    });
    expect(html).toContain("Back to reports");
  });
});

describe("Report — site summary image gallery", () => {
  const wiredSummary = {
    ...dailySummary,
    site_summaries: JSON.stringify({
      producthunt: {
        en: "- [AI] [Arc Browser](https://arc.net) — a browser",
        zh: "- [AI] [Arc Browser](https://arc.net) — 浏览器",
        images: [{ name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" }],
      },
      github: { en: "GH summary EN", zh: "GH summary ZH" },
    }),
  };

  it("renders a gallery of thumbnails when images exist", () => {
    const html = render({
      summary: wiredSummary,
      lang: "en",
      path: "/reports/2026-06-06",
    });
    expect(html).toContain('class="site-gallery"');
    expect(html).toContain('src="https://thumbs.example.com/arc.jpg"');
    expect(html).toContain('alt="Arc Browser"');
    expect(html).toContain("loading=\"lazy\"");
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it("links the gallery caption to the product URL from the summary", () => {
    const html = render({
      summary: wiredSummary,
      lang: "en",
      path: "/reports/2026-06-06",
    });
    expect(html).toContain('href="https://arc.net"');
    expect(html).toContain("Arc Browser");
  });

  it("links caption when image name is a substring of the summary link", () => {
    const substringSummary = {
      ...dailySummary,
      site_summaries: JSON.stringify({
        producthunt: {
          en: "- [AI] [Arc Browser](https://arc.net) — a browser",
          zh: "- [AI] [Arc Browser](https://arc.net) — 浏览器",
          images: [{ name: "Arc", url: "https://thumbs.example.com/arc.jpg" }],
        },
      }),
    };
    const html = render({
      summary: substringSummary,
      lang: "en",
      path: "/reports/2026-06-06",
    });
    expect(html).toContain('href="https://arc.net"');
    expect(html).toContain(">Arc</a>");
  });

  it("does not render a gallery when images are absent", () => {
    const html = render({
      summary: dailySummary,
      lang: "en",
      path: "/reports/2026-06-06",
    });
    expect(html).not.toContain('class="site-gallery"');
  });

  it("skips malformed images entries", () => {
    const malformed = {
      ...dailySummary,
      site_summaries: JSON.stringify({
        producthunt: {
          en: "- [AI] [Arc Browser](https://arc.net) — a browser",
          zh: "- [AI] [Arc Browser](https://arc.net) — 浏览器",
          images: [{ name: "Arc Browser", url: "not-a-url" }],
        },
      }),
    };
    const html = render({
      summary: malformed,
      lang: "en",
      path: "/reports/2026-06-06",
    });
    expect(html).not.toContain('class="site-gallery"');
  });

  it("renders the gallery on weekly reports too", () => {
    const weekly = {
      ...weeklySummary,
      site_summaries: JSON.stringify({
        producthunt: {
          en: "- [AI] [Arc Browser](https://arc.net) — a browser",
          zh: "- [AI] [Arc Browser](https://arc.net) — 浏览器",
          images: [{ name: "Arc Browser", url: "https://thumbs.example.com/arc.jpg" }],
        },
      }),
    };
    const html = render({
      summary: weekly as any,
      lang: "en",
      path: "/reports/weekly/2026-06-01",
      isWeekly: true,
    });
    expect(html).toContain('class="site-gallery"');
    expect(html).toContain('src="https://thumbs.example.com/arc.jpg"');
  });
});

describe("Report — malformed site_summaries", () => {
  it("handles invalid JSON gracefully", () => {
    const badSummary = {
      ...dailySummary,
      site_summaries: "not-valid-json",
    };
    const html = render({ summary: badSummary, lang: "en", path: "/reports/2026-06-06" });
    // Should not crash, just render without site summaries
    expect(html).toBeTruthy();
  });

  it("handles empty site_summaries", () => {
    const emptySummary = {
      ...dailySummary,
      site_summaries: "{}",
    };
    const html = render({ summary: emptySummary, lang: "en", path: "/reports/2026-06-06" });
    expect(html).toBeTruthy();
  });
});
