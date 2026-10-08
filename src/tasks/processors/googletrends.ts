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

export const DEFAULT_SEARCH_SEEDS = [
  "software for contractors",
  "software for photographers",
  "software for property management",
  "software for therapists",
  "app for realtors",
  "booking system for",
  "invoicing tool for",
  "simple crm for",
  "scheduling app for clients",
  "alternative to docusign for small business",
  "alternative to quickbooks for small business",
  "alternative to calendly",
  "ai app for interior design",
  "ai tool for teachers",
  "ai tool for marketing",
] as const;

export async function fetchGoogleTrends(
  geo: string = "US",
  seeds: readonly string[] = DEFAULT_SEARCH_SEEDS
): Promise<GoogleTrendsItem[]> {
  const geoLower = geo.toLowerCase();
  const seedResults = await Promise.allSettled(
    seeds.map((seed) => fetchGoogleAutocomplete(seed, "en", geoLower))
  );

  const items: GoogleTrendsItem[] = [];
  const seenTitles = new Set<string>();
  const now = new Date().toUTCString();

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const res = seedResults[i];
    if (res.status !== "fulfilled") continue;

    for (const suggestion of res.value) {
      const normalized = suggestion.trim().toLowerCase();
      if (!normalized || normalized === seed.toLowerCase() || seenTitles.has(normalized)) {
        continue;
      }

      seenTitles.add(normalized);

      const exploreLink = `https://trends.google.com/trends/explore?q=${encodeURIComponent(suggestion).replace(/%20/g, "+")}&geo=${encodeURIComponent(geo)}`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`;

      items.push({
        title: suggestion,
        approxTraffic: "High Intent",
        link: exploreLink,
        pubDate: now,
        newsItems: [
          {
            title: `Search demand for "${suggestion}"`,
            snippet: `High-intent user search query discovered via seed pattern "${seed}".`,
            url: searchUrl,
            source: "Google Search Intent",
          },
        ],
      });
    }
  }

  return items.slice(0, 25);
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
