import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchProductHuntTop10 } from "./producthunt";

const sampleFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Product Hunt</title>
  <entry>
    <id>tag:www.producthunt.com,2005:Post/123</id>
    <published>2026-06-01T09:00:00-07:00</published>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/foo"/>
    <title>Foo App</title>
    <content type="html">&lt;p&gt;An amazing foo tool&lt;/p&gt;</content>
    <author><name>Alice</name></author>
  </entry>
  <entry>
    <id>tag:www.producthunt.com,2005:Post/456</id>
    <published>2026-06-01T10:00:00-07:00</published>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/bar"/>
    <title>Bar Service</title>
    <content type="html">&lt;p&gt;The best bar service ever&lt;/p&gt;</content>
    <author><name>Bob</name></author>
  </entry>
  <entry>
    <id>tag:www.producthunt.com,2005:Post/789</id>
    <published>2026-05-31T08:00:00-07:00</published>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/baz"/>
    <title>Baz Widget</title>
    <content type="html">&lt;p&gt;Widget for everything&lt;/p&gt;</content>
    <author><name>Charlie</name></author>
  </entry>
</feed>`;

describe("fetchProductHuntTop10", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(sampleFeed, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        })
      )
    ) as typeof globalThis.fetch;
  });

  it("returns parsed Product Hunt items", async () => {
    const items = await fetchProductHuntTop10();
    expect(items).toHaveLength(3);
  });

  it("extracts correct product name", async () => {
    const items = await fetchProductHuntTop10();
    expect(items[0].name).toBe("Foo App");
  });

  it("extracts tagline from content", async () => {
    const items = await fetchProductHuntTop10();
    expect(items[0].tagline).toBe("An amazing foo tool");
  });

  it("extracts product link", async () => {
    const items = await fetchProductHuntTop10();
    expect(items[0].link).toBe("https://www.producthunt.com/products/foo");
  });

  it("extracts author name", async () => {
    const items = await fetchProductHuntTop10();
    expect(items[0].author).toBe("Alice");
  });

  it("extracts published date", async () => {
    const items = await fetchProductHuntTop10();
    expect(items[0].published).toBe("2026-06-01T09:00:00-07:00");
  });

  it("handles empty feed gracefully", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          '<feed xmlns="http://www.w3.org/2005/Atom"><title>PH</title></feed>',
          { status: 200, headers: { "Content-Type": "application/xml" } }
        )
      )
    ) as typeof globalThis.fetch;

    const items = await fetchProductHuntTop10();
    expect(items).toHaveLength(0);
  });

  it("skips entries without a title", async () => {
    const badFeed = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:www.producthunt.com,2005:Post/000</id>
    <published>2026-06-01T09:00:00-07:00</published>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/x"/>
    <content type="html">&lt;p&gt;desc&lt;/p&gt;</content>
    <author><name>Nemo</name></author>
  </entry>
  <entry>
    <id>tag:www.producthunt.com,2005:Post/111</id>
    <published>2026-06-01T10:00:00-07:00</published>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/valid"/>
    <title>Valid Product</title>
    <content type="html">&lt;p&gt;valid desc&lt;/p&gt;</content>
    <author><name>Alice</name></author>
  </entry>
</feed>`;

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(badFeed, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        })
      )
    ) as typeof globalThis.fetch;

    const items = await fetchProductHuntTop10();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Valid Product");
  });

  it("returns at most 10 items even if feed has more", async () => {
    const entries = Array.from({ length: 15 }, (_, i) => `
  <entry>
    <id>tag:www.producthunt.com,2005:Post/${i}</id>
    <published>2026-06-01</published>
    <link rel="alternate" type="text/html" href="https://www.producthunt.com/products/p${i}"/>
    <title>Product ${i}</title>
    <content type="html">&lt;p&gt;desc ${i}&lt;/p&gt;</content>
    <author><name>Author ${i}</name></author>
  </entry>`).join("");

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`,
          { status: 200, headers: { "Content-Type": "application/xml" } }
        )
      )
    ) as typeof globalThis.fetch;

    const items = await fetchProductHuntTop10();
    expect(items).toHaveLength(10);
  });
});
