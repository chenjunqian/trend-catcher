// GitHub Trending scraper: parses the trending page HTML (server-rendered)

import * as cheerio from "cheerio";
import { fetchHtml } from "../../utils/fetcher";

export interface GitHubTrendingItem {
  owner: string;
  repo: string;
  description: string;
  language: string;
  stars: number;
  starsToday: number;
  link: string;
}

export async function fetchGitHubTrending(): Promise<GitHubTrendingItem[]> {
  console.log("[github] Fetching trending page...");
  const startMs = Date.now();

  const html = await fetchHtml("https://github.com/trending");
  const $ = cheerio.load(html);
  const items: GitHubTrendingItem[] = [];

  // Each trending repo is an article.Box-row
  $("article.Box-row").each((_, el) => {
    const article = $(el);

    const nameLink = article.find("h2 a");
    const href = (nameLink.attr("href") || "").trim();
    const parts = href.replace(/^\//, "").split("/");
    if (parts.length < 2) return;

    const owner = parts[0];
    const repo = parts[1];

    const description = article.find("p").first().text().trim();

    const language =
      article.find("[itemprop='programmingLanguage']").text().trim() || "";

    const stars = parseInt(
      article
        .find("a[href*='/stargazers']")
        .text()
        .trim()
        .replace(/[^0-9]/g, "") || "0",
      10
    ) || 0;

    const starsTodayMatch = article
      .find(".d-inline-block.float-sm-right")
      .text()
      .trim()
      .match(/([\d,]+)\s*stars/);
    const starsToday = starsTodayMatch
      ? parseInt(starsTodayMatch[1].replace(/,/g, ""), 10)
      : 0;

    items.push({
      owner,
      repo,
      description,
      language,
      stars,
      starsToday,
      link: `https://github.com${href}`,
    });
  });

  const elapsed = Date.now() - startMs;
  console.log(`[github] ✅ ${items.length} repos (${elapsed}ms)`);
  return items.slice(0, 25);
}
