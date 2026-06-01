// Product Hunt scraper: parses the Atom RSS feed at /feed (not blocked by Cloudflare)

import { fetchHtml } from "../../utils/fetcher";

export interface ProductHuntItem {
  name: string;
  tagline: string;
  link: string;
  author: string;
  published: string;
}

export async function fetchProductHuntTop10(): Promise<ProductHuntItem[]> {
  const xml = await fetchHtml("https://www.producthunt.com/feed");
  const items: ProductHuntItem[] = [];

  // Parse Atom feed entries with regex
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1];

    const title = extractTag(entryXml, "title");
    const link = extractAttr(entryXml, 'link[^>]*rel="alternate"[^>]*href="([^"]*)"') ||
                 extractTag(entryXml, "link");
    const content = extractTag(entryXml, "content");
    const author = extractTag(entryXml, "name"); // inside <author>
    const published = extractTag(entryXml, "published");

    if (!title) continue;

    // Content is HTML-encoded; decode entities to extract the first <p> text
    const decoded = decodeEntities(content);
    const tagline = extractFirstParagraph(decoded);

    items.push({
      name: title,
      tagline,
      link: link.startsWith("http") ? link : `https://www.producthunt.com${link}`,
      author,
      published,
    });
  }

  return items.slice(0, 10);
}

function extractTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : "";
}

function extractAttr(xml: string, pattern: string): string {
  const match = new RegExp(pattern, "i").exec(xml);
  return match ? match[1] : "";
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

function extractFirstParagraph(html: string): string {
  const match = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (match) {
    return match[1].replace(/<[^>]+>/g, "").trim();
  }
  return html.replace(/<[^>]+>/g, "").trim();
}
