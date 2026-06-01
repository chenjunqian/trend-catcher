// Hacker News scraper: uses the official Firebase API (free, no auth required)

import { fetchJson } from "../../utils/fetcher";

interface HNItem {
  id: number;
  type: string;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  by?: string;
  time?: number;
}

export interface HackerNewsItem {
  id: number;
  title: string;
  url: string;
  score: number;
  comments: number;
  author: string;
}

export async function fetchHackerNewsTop30(): Promise<HackerNewsItem[]> {
  // Get top story IDs
  const ids = await fetchJson<number[]>(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );

  const topIds = ids.slice(0, 30);

  // Fetch each story's details in parallel
  const items = await Promise.all(
    topIds.map((id) =>
      fetchJson<HNItem>(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
      )
    )
  );

  return items
    .filter((item): item is HNItem & { title: string } => !!item?.title)
    .map((item) => ({
      id: item.id,
      title: item.title,
      url:
        item.url ||
        `https://news.ycombinator.com/item?id=${item.id}`,
      score: item.score ?? 0,
      comments: item.descendants ?? 0,
      author: item.by ?? "unknown",
    }));
}
