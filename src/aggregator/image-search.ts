import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { fetchHtml, fetchJson, fetchBinary } from "../utils/fetcher";

export interface ImageCandidate {
  title: string;
  thumbnail: string;
  image: string;
  sourceUrl: string;
}

const DDG_BASE = "https://duckduckgo.com";

function extractVqd(html: string): string | null {
  const match = /vqd[=:]\s*["']?([\w~-]+)/i.exec(html);
  return match ? match[1] : null;
}

export async function searchImages(
  query: string,
  limit: number = 4
): Promise<ImageCandidate[]> {
  try {
    const encoded = encodeURIComponent(query);
    const html = await fetchHtml(
      `${DDG_BASE}/?q=${encoded}&iax=images&ia=images`,
      1
    );
    const vqd = extractVqd(html);
    if (!vqd) return [];

    const data = await fetchJson<{
      results?: Array<{
        title?: string;
        thumbnail?: string;
        image?: string;
        url?: string;
      }>;
    }>(
      `${DDG_BASE}/i.js?l=en-us&o=json&q=${encoded}&vqd=${vqd}&p=1&f=,,,`,
      1
    );

    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .filter((r) => !!r.thumbnail && !!r.image)
      .slice(0, limit)
      .map((r) => ({
        title: r.title ?? "",
        thumbnail: r.thumbnail as string,
        image: r.image as string,
        sourceUrl: r.url ?? "",
      }));
  } catch {
    return [];
  }
}

export function buildImageSelectionPrompt(query: string): string {
  return `You are an image relevance judge. Below are candidate images (indexed starting at 0) for the product or topic "${query}". Pick the single image that best represents it. Prefer the official logo, product screenshot, or hero image. Reject images that are irrelevant, broken, or of very low quality. Reply with ONLY JSON in this exact shape: {"index": 0}. No other text.`;
}

interface FetchedImage {
  candidate: ImageCandidate;
  bytes: Uint8Array;
  mimeType: string;
}

export async function selectBestImage(
  model: LanguageModelV1 | null,
  query: string,
  candidates: ImageCandidate[],
  maxImages: number = 3
): Promise<ImageCandidate | null> {
  if (candidates.length === 0) return null;
  const top = candidates.slice(0, maxImages);

  if (!model) return top[0];

  const fetched: FetchedImage[] = [];
  for (const candidate of top) {
    try {
      const { data, mimeType } = await fetchBinary(candidate.thumbnail);
      fetched.push({ candidate, bytes: data, mimeType });
    } catch {
      // skip images that could not be fetched
    }
  }

  if (fetched.length === 0) return top[0];

  try {
    const response = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildImageSelectionPrompt(query) },
            ...fetched.map((f) => ({
              type: "image" as const,
              image: f.bytes,
              mimeType: f.mimeType,
            })),
          ],
        },
      ],
      maxTokens: 32,
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    const index = parsed?.index;

    if (
      typeof index === "number" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < fetched.length
    ) {
      return fetched[index].candidate;
    }
    return fetched[0].candidate;
  } catch {
    return fetched[0].candidate;
  }
}

function absolutizeImageUrl(value: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

export async function extractOpenGraphImage(pageUrl: string): Promise<string | null> {
  let html: string;
  try {
    html = await fetchHtml(pageUrl, 2);
  } catch {
    return null;
  }

  const tag = "(?:og:image|og:image:url|og:image:secure_url|twitter:image)";
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${tag}["'][^>]*content=["']([^"']+)["'][^>]*>`, "gi"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${tag}["'][^>]*>`, "gi"),
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const resolved = absolutizeImageUrl(match[1], pageUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

export function getRepoPreviewImage(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com" && parsed.hostname !== "www.github.com") {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    const repo = parts[1]?.replace(/\.git$/, "");
    if (!owner || !repo) return null;
    return `https://opengraph.githubassets.com/1/${owner}/${repo}`;
  } catch {
    return null;
  }
}

export async function isImageUrlFetchable(url: string): Promise<boolean> {
  try {
    await fetchBinary(url, 512 * 1024);
    return true;
  } catch {
    return false;
  }
}

export async function resolveItemImage(url: string): Promise<string | null> {
  const repoPreview = getRepoPreviewImage(url);
  if (repoPreview) return repoPreview;

  if (!/^https?:\/\//.test(url)) return null;

  const ogImage = await extractOpenGraphImage(url);
  if (!ogImage) return null;

  if (await isImageUrlFetchable(ogImage)) return ogImage;
  return null;
}

function namesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 4 && right.length >= 4) {
    return left.includes(right) || right.includes(left);
  }
  return false;
}

export function extractItemUrlByName(
  items: unknown[],
  name: string
): string | undefined {
  for (const item of items.flat()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const nameField =
      typeof record.name === "string"
        ? record.name
        : typeof record.title === "string"
          ? record.title
          : "";
    const ownerField = typeof record.owner === "string" ? record.owner : "";
    const repoField = typeof record.repo === "string" ? record.repo : "";
    const nameCandidates = [nameField, repoField, ownerField && repoField ? `${ownerField}/${repoField}` : ""].filter(
      (candidate) => candidate !== ""
    );
    const matched = nameCandidates.some((candidate) => namesMatch(candidate, name));
    if (!matched) continue;

    for (const key of ["link", "url"] as const) {
      const value = record[key];
      if (typeof value === "string" && /^https?:\/\//.test(value)) {
        return value;
      }
    }
  }
  return undefined;
}

export function extractLinkByName(
  markdown: string,
  name: string
): string | undefined {
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    if (namesMatch(match[1], name)) {
      return match[2].trim();
    }
  }
  return undefined;
}
