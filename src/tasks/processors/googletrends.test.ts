import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchGoogleTrends, fetchGoogleAutocomplete, DEFAULT_SEARCH_SEEDS } from "./googletrends";

describe("DEFAULT_SEARCH_SEEDS", () => {
  it("contains high-intent developer and software seed patterns", () => {
    expect(DEFAULT_SEARCH_SEEDS.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_SEARCH_SEEDS).toContain("software for contractors");
    expect(DEFAULT_SEARCH_SEEDS).toContain("booking system for");
    expect(DEFAULT_SEARCH_SEEDS).toContain("alternative to docusign for small business");
  });
});

describe("fetchGoogleTrends", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches high-intent search queries from seeds via autocomplete", async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("open%20source%20alternative%20to") || urlStr.includes("open+source+alternative+to")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              "open source alternative to",
              ["open source alternative to claude code", "open source alternative to obsidian"],
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify([
            "ai tool for",
            ["ai tool for resume", "ai tool for interior design"],
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US", [
      "open source alternative to",
      "ai tool for",
    ]);

    expect(items.length).toBe(4);
    expect(items[0].title).toBe("open source alternative to claude code");
    expect(items[0].approxTraffic).toBe("High Intent");
    expect(items[0].link).toContain("trends.google.com/trends/explore?q=open+source+alternative+to+claude+code");
    expect(items[0].link).toContain("geo=US");
    expect(items[0].newsItems).toHaveLength(1);
    expect(items[0].newsItems[0].source).toBe("Google Search Intent");
    expect(items[0].newsItems[0].url).toContain("https://www.google.com/search?q=");
  });

  it("deduplicates suggestions and skips exact matches to seed", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            "open source alternative to",
            [
              "open source alternative to", // exact match to seed, should be skipped
              "open source alternative to figma",
              "open source alternative to figma", // duplicate
            ],
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    ) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US", ["open source alternative to"]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("open source alternative to figma");
  });

  it("handles empty or failed seed requests gracefully", async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("fail")) {
        return Promise.reject(new Error("Network boom"));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify(["seed", ["useful tool idea"]]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }) as typeof globalThis.fetch;

    const items = await fetchGoogleTrends("US", ["fail seed", "good seed"]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("useful tool idea");
  });

  it("limits results to a maximum of 25 items", async () => {
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = decodeURIComponent(url.toString());
      const match = urlStr.match(/seed-(\d+)/);
      const idx = match ? match[1] : "0";
      const suggestions = Array.from({ length: 10 }, (_, i) => `item-from-seed-${idx}-${i}`);
      return Promise.resolve(
        new Response(
          JSON.stringify([`seed-${idx}`, suggestions]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }) as typeof globalThis.fetch;

    const seeds = ["seed-1", "seed-2", "seed-3", "seed-4"];
    const items = await fetchGoogleTrends("US", seeds);
    expect(items).toHaveLength(25);
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
