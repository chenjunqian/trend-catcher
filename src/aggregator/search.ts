import * as cheerio from "cheerio";
import { fetchHtml } from "../utils/fetcher";

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

  try {
    const html = await fetchHtml(url, 1);
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
    console.log(`[search] DDG failed for "${query.slice(0, 50)}": ${(err as Error).message}`);
    return [];
  }
}
