import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchGoogleTrends, fetchGoogleAutocomplete } from "./googletrends";

const sampleTrendsRss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
  <channel>
    <title>Daily Search Trends</title>
    <description>Recent searches</description>
    <link>https://trends.google.com/trending/rss?geo=US</link>
    <item>
      <title>deepseek ai</title>
      <ht:approx_traffic>50,000+</ht:approx_traffic>
      <description/>
      <link>https://trends.google.com/trending/rss?geo=US</link>
      <pubDate>Sat, 3 Oct 2026 09:10:00 -0700</pubDate>
      <ht:picture>https://example.com/pic1.jpg</ht:picture>
      <ht:news_item>
        <ht:news_item_title>DeepSeek unveils new model breakthrough</ht:news_item_title>
        <ht:news_item_snippet>DeepSeek announces next generation open weights model.</ht:news_item_snippet>
        <ht:news_item_url>https://example.com/news1</ht:news_item_url>
        <ht:news_item_source>TechCrunch</ht:news_item_source>
      </ht:news_item>
      <ht:news_item>
        <ht:news_item_title>Open source AI surge continues</ht:news_item_title>
        <ht:news_item_snippet>Market reaction to DeepSeek.</ht:news_item_snippet>
        <ht:news_item_url>https://example.com/news2</ht:news_item_url>
        <ht:news_item_source>The Verge</ht:news_item_source>
      </ht:news_item>
    </item>
    <item>
      <title>nextjs 16 release</title>
      <ht:approx_traffic>10,000+</ht:approx_traffic>
      <description/>
      <link>https://trends.google.com/trending/rss?geo=US</link>
      <pubDate>Sat, 3 Oct 2026 08:00:00 -0700</pubDate>
      <ht:news_item>
        <ht:news_item_title>Next.js 16 released with server actions</ht:news_item_title>
        <ht:news_item_snippet>Vercel announces latest Next.js updates.</ht:news_item_snippet>
        <ht:news_item_url>https://example.com/news3</ht:news_item_url>
        <ht:news_item_source>Vercel Blog</ht:news_item_source>
      </ht:news_item>
    </item>
    <item>
      <title>cursor editor update</title>
      <ht:approx_traffic>5,000+</ht:approx_traffic>
      <description/>
      <link>https://trends.google.com/trending/rss?geo=US</link>
      <pubDate>Sat, 3 Oct 2026 07:00:00 -0700</pubDate>
    </item>
  </channel>
</rss>`;

describe("fetchGoogleTrends", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses Google Trends items from RSS", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(sampleTrendsRss, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        })
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US");
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("deepseek ai");
    expect(items[0].approxTraffic).toBe("50,000+");
    expect(items[0].pubDate).toBe("Sat, 3 Oct 2026 09:10:00 -0700");
    expect(items[0].link).toContain("trends.google.com/trends/explore?q=deepseek+ai");
    expect(items[0].newsItems).toHaveLength(2);
    expect(items[0].newsItems[0]).toEqual({
      title: "DeepSeek unveils new model breakthrough",
      snippet: "DeepSeek announces next generation open weights model.",
      url: "https://example.com/news1",
      source: "TechCrunch",
    });
  });

  it("handles items without news items", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(sampleTrendsRss, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        })
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US");
    expect(items[2].title).toBe("cursor editor update");
    expect(items[2].newsItems).toEqual([]);
  });

  it("handles empty feed gracefully", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          '<?xml version="1.0"?><rss><channel><title>Daily</title></channel></rss>',
          { status: 200, headers: { "Content-Type": "application/xml" } }
        )
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US");
    expect(items).toEqual([]);
  });

  it("skips entries without a title", async () => {
    const badFeed = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <ht:approx_traffic>10,000+</ht:approx_traffic>
        </item>
        <item>
          <title>valid query</title>
          <ht:approx_traffic>20,000+</ht:approx_traffic>
        </item>
      </channel>
    </rss>`;

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(badFeed, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        })
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("valid query");
  });

  it("limits results to top 20 items", async () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => `
      <item>
        <title>Query ${i}</title>
        <ht:approx_traffic>${(i + 1) * 1000}+</ht:approx_traffic>
      </item>`).join("");

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          `<?xml version="1.0"?><rss><channel>${manyItems}</channel></rss>`,
          { status: 200, headers: { "Content-Type": "application/xml" } }
        )
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US");
    expect(items).toHaveLength(20);
  });
});

describe("fetchGoogleAutocomplete", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns suggestions list from Google Autocomplete API", async () => {
    const mockResponse = [
      "nextjs",
      ["nextjs 16", "nextjs vs react", "nextjs alternative", "nextjs tutorial"],
      ["", "", "", ""],
      [],
    ];

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("nextjs");
    expect(suggestions).toEqual([
      "nextjs 16",
      "nextjs vs react",
      "nextjs alternative",
      "nextjs tutorial",
    ]);
  });

  it("handles empty suggestions gracefully", async () => {
    const mockResponse = ["xyzrandomtermnotfound", []];

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("xyzrandomtermnotfound");
    expect(suggestions).toEqual([]);
  });

  it("handles network error gracefully and returns empty array", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error("Network error"))
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("failing");
    expect(suggestions).toEqual([]);
  });
});
