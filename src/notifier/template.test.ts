import { describe, it, expect } from "vitest";
import { buildEmailHtml, markdownToHtml } from "./template";

describe("markdownToHtml", () => {
  it("renders headings with inline serif styling", () => {
    const html = markdownToHtml("## Overall Trend\nBody text");
    expect(html).toContain("<h2");
    expect(html).toContain("Overall Trend");
    expect(html).toContain("serif");
  });

  it("renders links in ink blue", () => {
    const html = markdownToHtml("See [the story](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("#1B365D");
  });

  it("renders bullet lists", () => {
    const html = markdownToHtml("- one\n- two");
    expect(html).toContain("<li");
    expect(html).toContain("one");
    expect(html).toContain("two");
  });

  it("renders bold text", () => {
    const html = markdownToHtml("**Key point**");
    expect(html).toContain("<strong");
    expect(html).toContain("Key point");
  });
});

describe("buildEmailHtml", () => {
  it("uses the kami parchment background and serif stack", () => {
    const html = buildEmailHtml("EN report", "中文报告", "Trend Catcher");
    expect(html).toContain("#f5f4ed");
    expect(html).toContain("TsangerJinKai02");
    expect(html).toContain("Georgia");
    expect(html).not.toContain("#fafafa");
    expect(html).not.toContain("#f78166");
  });

  it("includes both language reports", () => {
    const html = buildEmailHtml("EN report", "中文报告", "Trend Catcher");
    expect(html).toContain("EN report");
    expect(html).toContain("中文报告");
    expect(html).toContain("English Report");
    expect(html).toContain("中文报告");
  });

  it("renders the unsubscribe link when provided", () => {
    const html = buildEmailHtml("EN", "ZH", "Title", "https://example.com/unsubscribe");
    expect(html).toContain("https://example.com/unsubscribe");
    expect(html).toContain("Unsubscribe");
  });

  it("omits the unsubscribe block when not provided", () => {
    const html = buildEmailHtml("EN", "ZH", "Title");
    expect(html).not.toContain("Unsubscribe / 取消订阅");
  });
});
