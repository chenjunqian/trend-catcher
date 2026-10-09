import { fetchHtml } from "../../utils/fetcher";



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
