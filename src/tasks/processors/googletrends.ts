import { fetchHtml } from "../../utils/fetcher";

export interface GoogleTrendsNewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface GoogleTrendsItem {
  title: string;
  approxTraffic: string;
  link: string;
  pubDate: string;
  newsItems: GoogleTrendsNewsItem[];
}

export async function fetchGoogleTrends(geo: string = "US"): Promise<GoogleTrendsItem[]> {
  const xml = await fetchHtml(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`);
  const items: GoogleTrendsItem[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];

    const title = extractTag(itemXml, "title");
    if (!title) continue;

    const approxTraffic = extractTag(itemXml, "ht:approx_traffic");
    const pubDate = extractTag(itemXml, "pubDate");
    const exploreLink = `https://trends.google.com/trends/explore?q=${encodeURIComponent(title).replace(/%20/g, "+")}&geo=${encodeURIComponent(geo)}`;

    const newsItems: GoogleTrendsNewsItem[] = [];
    const newsRegex = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/g;
    let newsMatch: RegExpExecArray | null;

    while ((newsMatch = newsRegex.exec(itemXml)) !== null) {
      const newsXml = newsMatch[1];
      const newsTitle = extractTag(newsXml, "ht:news_item_title");
      const snippet = extractTag(newsXml, "ht:news_item_snippet");
      const url = extractTag(newsXml, "ht:news_item_url");
      const source = extractTag(newsXml, "ht:news_item_source");

      if (newsTitle || url) {
        newsItems.push({
          title: decodeEntities(newsTitle),
          snippet: decodeEntities(snippet),
          url,
          source: decodeEntities(source),
        });
      }
    }

    items.push({
      title: decodeEntities(title),
      approxTraffic,
      link: exploreLink,
      pubDate,
      newsItems,
    });
  }

  return items.slice(0, 20);
}

export async function fetchGoogleAutocomplete(
  query: string,
  lang: string = "en",
  geo: string = "us"
): Promise<string[]> {
  if (!query || !query.trim()) {
    return [];
  }

  const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(geo)}&q=${encodeURIComponent(query.trim())}`;

  try {
    const raw = await fetchHtml(url, 2);
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
      return (parsed[1] as unknown[])
        .filter((item): item is string => typeof item === "string")
        .slice(0, 10);
    }

    return [];
  } catch {
    return [];
  }
}

function extractTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : "";
}

function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}
