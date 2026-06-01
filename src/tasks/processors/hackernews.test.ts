import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchHackerNewsTop30 } from "./hackernews";

const mockTopStories = [48356625, 48353348, 48345840];

const mockItems: Record<number, Record<string, unknown>> = {
  48356625: {
    id: 48356625,
    title: "NPM packages from Red Hat compromised",
    url: "https://example.com/npm-redhat",
    score: 440,
    descendants: 219,
    by: "kurmiashish",
    type: "story",
  },
  48353348: {
    id: 48353348,
    title: "A 10 year old Xeon is all you need",
    url: "https://example.com/xeon",
    score: 459,
    descendants: 198,
    by: "cafkafk",
    type: "story",
  },
  48345840: {
    id: 48345840,
    title: "Cloudflare Turnstile requiring WebGL",
    url: "https://example.com/turnstile",
    score: 744,
    descendants: 428,
    by: "HypnoticOcelot",
    type: "story",
  },
};

describe("fetchHackerNewsTop30", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("topstories.json")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockTopStories), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      const match = url.match(/item\/(\d+)\.json/);
      if (match && mockItems[Number(match[1])]) {
        return Promise.resolve(
          new Response(JSON.stringify(mockItems[Number(match[1])]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response("null", { status: 200 }));
    }) as typeof globalThis.fetch;
  });

  it("returns parsed HN items", async () => {
    const items = await fetchHackerNewsTop30();
    expect(items).toHaveLength(3);
  });

  it("extracts correct title", async () => {
    const items = await fetchHackerNewsTop30();
    expect(items[0].title).toBe("NPM packages from Red Hat compromised");
  });

  it("extracts score as number", async () => {
    const items = await fetchHackerNewsTop30();
    expect(items[0].score).toBe(440);
    expect(typeof items[0].score).toBe("number");
  });

  it("extracts comment count", async () => {
    const items = await fetchHackerNewsTop30();
    expect(items[0].comments).toBe(219);
  });

  it("extracts author", async () => {
    const items = await fetchHackerNewsTop30();
    expect(items[0].author).toBe("kurmiashish");
  });

  it("extracts URL", async () => {
    const items = await fetchHackerNewsTop30();
    expect(items[0].url).toBe("https://example.com/npm-redhat");
  });

  it("uses HN discussion link when url is missing", async () => {
    const id = 48356625;
    mockItems[id] = { ...mockItems[id], url: undefined };
    const items = await fetchHackerNewsTop30();
    expect(items[0].url).toBe(
      `https://news.ycombinator.com/item?id=${id}`
    );
  });

  it("filters out items without titles", async () => {
    mockItems[48353348] = { id: 48353348, type: "story" };
    const items = await fetchHackerNewsTop30();
    expect(items).toHaveLength(2);
  });

  it("defaults missing score to 0", async () => {
    mockItems[48356625] = {
      id: 48356625,
      title: "Test",
      type: "story",
    };
    const items = await fetchHackerNewsTop30();
    expect(items[0].score).toBe(0);
  });

  it("defaults missing author to unknown", async () => {
    mockItems[48356625] = {
      id: 48356625,
      title: "Test",
      type: "story",
    };
    const items = await fetchHackerNewsTop30();
    expect(items[0].author).toBe("unknown");
  });
});
