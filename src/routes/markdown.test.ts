import { describe, it, expect } from "vitest";
import { renderMarkdown, stripMarkdownPreview } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings followed by paragraphs", () => {
    const html = renderMarkdown("## Today\n\nSome analysis follows.");
    expect(html).toContain("<h2>Today</h2>");
    expect(html).toContain("<p>Some analysis follows.</p>");
  });

  it("renders a heading without a blank line before its paragraph", () => {
    const html = renderMarkdown("## Today\nSome analysis follows.");
    expect(html).toContain("<h2>Today</h2>");
    expect(html).toContain("<p>Some analysis follows.</p>");
  });

  it("renders unordered lists", () => {
    const html = renderMarkdown("- one\n- two");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("renders ordered lists", () => {
    const html = renderMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<li>second</li>");
  });

  it("renders a list directly after a paragraph", () => {
    const html = renderMarkdown("Signals:\n- one\n- two");
    expect(html).toContain("<p>Signals:</p>");
    expect(html).toContain("<li>one</li>");
  });

  it("renders blockquotes", () => {
    const html = renderMarkdown("> quoted line");
    expect(html).toContain("<blockquote>quoted line</blockquote>");
  });

  it("renders links with noopener", () => {
    const html = renderMarkdown("See [the story](https://example.com).");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain(">the story</a>");
  });

  it("renders bold and inline code", () => {
    const html = renderMarkdown("**Key** and `code`");
    expect(html).toContain("<strong>Key</strong>");
    expect(html).toContain("<code>code</code>");
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});

describe("stripMarkdownPreview", () => {
  it("removes headings, links and bold markers", () => {
    const preview = stripMarkdownPreview("## Title\n\nSee [the story](https://example.com) and **more**.");
    expect(preview).not.toContain("##");
    expect(preview).not.toContain("https://example.com");
    expect(preview).not.toContain("**");
    expect(preview).toContain("the story");
  });

  it("truncates long content", () => {
    const preview = stripMarkdownPreview("x".repeat(400), 100);
    expect(preview.length).toBeLessThanOrEqual(103);
    expect(preview.endsWith("...")).toBe(true);
  });
});
