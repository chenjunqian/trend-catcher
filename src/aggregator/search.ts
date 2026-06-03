import * as cheerio from "cheerio";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function extractRealUrl(href: string): string {
  try {
    const parsed = new URL(href);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) {
      return decodeURIComponent(uddg);
    }
  } catch {
    // href is not a valid URL, use as-is
  }
  return href;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.log(`[search] DDG HTTP ${response.status} for "${query.slice(0, 50)}"`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      const link = $(el).find(".result__a");
      const snippetEl = $(el).find(".result__snippet");

      const title = link.text().trim();
      const href = (link.attr("href") || "").trim();
      const snippet = snippetEl.text().trim();

      if (!title || !href) return;

      const cleanUrl = extractRealUrl(href);

      if (!cleanUrl.startsWith("http")) return;

      results.push({ title, url: cleanUrl, snippet });
    });

    return results.slice(0, 8);
  } catch (err) {
    clearTimeout(timer);
    console.log(`[search] DDG failed for "${query.slice(0, 50)}": ${(err as Error).message}`);
    return [];
  }
}
