import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchGitHubTrending } from "./github";

const sampleHtml = `<!DOCTYPE html>
<html>
<body>
<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a href="/microsoft/markitdown">
      <span data-view-component="true">microsoft</span>
      <span class="text-normal"> / </span>
      <span class="text-bold" data-view-component="true">markitdown</span>
    </a>
  </h2>
  <p class="col-9 color-fg-muted my-1 pr-4">Python tool for converting files to Markdown.</p>
  <div class="f6 color-fg-muted mt-2">
    <span itemprop="programmingLanguage">Python</span>
    <a href="/microsoft/markitdown/stargazers">137,335</a>
    <span class="d-inline-block float-sm-right">3,086 stars today</span>
  </div>
</article>
<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a href="/torvalds/linux">
      <span data-view-component="true">torvalds</span>
      <span class="text-normal"> / </span>
      <span class="text-bold" data-view-component="true">linux</span>
    </a>
  </h2>
  <p class="col-9 color-fg-muted my-1 pr-4">Linux kernel source tree</p>
  <div class="f6 color-fg-muted mt-2">
    <span itemprop="programmingLanguage">C</span>
    <a href="/torvalds/linux/stargazers">200,000</a>
    <span class="d-inline-block float-sm-right">150 stars today</span>
  </div>
</article>
<article class="Box-row">
  <h2 class="h3 lh-condensed">
    <a href="/no-desc/repo-only">
      <span data-view-component="true">no-desc</span>
      <span class="text-normal"> / </span>
      <span class="text-bold" data-view-component="true">repo-only</span>
    </a>
  </h2>
  <div class="f6 color-fg-muted mt-2">
    <span itemprop="programmingLanguage">Rust</span>
    <a href="/no-desc/repo-only/stargazers">5,000</a>
    <span class="d-inline-block float-sm-right">42 stars today</span>
  </div>
</article>
</body>
</html>`;

describe("fetchGitHubTrending", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(sampleHtml, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    ) as typeof globalThis.fetch;
  });

  it("returns parsed trending repos", async () => {
    const items = await fetchGitHubTrending();
    expect(items).toHaveLength(3);
  });

  it("extracts owner and repo", async () => {
    const items = await fetchGitHubTrending();
    expect(items[0].owner).toBe("microsoft");
    expect(items[0].repo).toBe("markitdown");
  });

  it("extracts description", async () => {
    const items = await fetchGitHubTrending();
    expect(items[0].description).toBe(
      "Python tool for converting files to Markdown."
    );
  });

  it("extracts language", async () => {
    const items = await fetchGitHubTrending();
    expect(items[0].language).toBe("Python");
  });

  it("extracts star count", async () => {
    const items = await fetchGitHubTrending();
    expect(items[0].stars).toBe(137335);
  });

  it("extracts stars today", async () => {
    const items = await fetchGitHubTrending();
    expect(items[0].starsToday).toBe(3086);
  });

  it("extracts link", async () => {
    const items = await fetchGitHubTrending();
    expect(items[0].link).toBe("https://github.com/microsoft/markitdown");
  });

  it("handles missing description", async () => {
    const items = await fetchGitHubTrending();
    expect(items[2].description).toBe("");
  });

  it("handles empty response", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response("<html><body></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGitHubTrending();
    expect(items).toHaveLength(0);
  });

  it("skips entries with invalid href", async () => {
    const badHtml = `<!DOCTYPE html>
<html><body>
<article class="Box-row">
  <h2 class="h3"><a href="/single-part">bad</a></h2>
  <div class="f6"><a href="/single-part/stargazers">100</a></div>
</article>
</body></html>`;

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(badHtml, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGitHubTrending();
    expect(items).toHaveLength(0);
  });
});
