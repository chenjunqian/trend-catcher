import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("../utils/fetcher", () => ({
  fetchHtml: vi.fn(),
  fetchJson: vi.fn(),
  fetchBinary: vi.fn(),
}));

import { generateText } from "ai";
import { fetchHtml, fetchJson, fetchBinary } from "../utils/fetcher";
import {
  searchImages,
  selectBestImage,
  buildImageSelectionPrompt,
  extractOpenGraphImage,
  getRepoPreviewImage,
  isImageUrlFetchable,
  resolveItemImage,
  extractItemUrlByName,
  extractLinkByName,
  type ImageCandidate,
} from "./image-search";

const mockModel = {} as never;

function candidate(overrides: Partial<ImageCandidate> = {}): ImageCandidate {
  return {
    title: "Arc Browser",
    thumbnail: "https://thumbs.example.com/arc.jpg",
    image: "https://example.com/arc.jpg",
    sourceUrl: "https://arc.net",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchImages", () => {
  it("resolves vqd token and maps image results", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><script>vqd="4-1234567890-123"</script></html>'
    );
    vi.mocked(fetchJson).mockResolvedValueOnce({
      results: [
        {
          title: "Arc Browser",
          thumbnail: "https://thumbs.example.com/arc.jpg",
          image: "https://example.com/arc.jpg",
          url: "https://arc.net",
          width: 800,
          height: 500,
        },
        { thumbnail: "https://thumbs.example.com/ignored.jpg" },
      ],
    });

    const results = await searchImages("Arc Browser");

    expect(fetchHtml).toHaveBeenCalledWith(
      "https://duckduckgo.com/?q=Arc%20Browser&iax=images&ia=images",
      1
    );
    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining("vqd=4-1234567890-123"),
      1
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: "Arc Browser",
      thumbnail: "https://thumbs.example.com/arc.jpg",
      image: "https://example.com/arc.jpg",
      sourceUrl: "https://arc.net",
    });
  });

  it("caps results at the limit", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce("<html>vqd=4-999</html>");
    vi.mocked(fetchJson).mockResolvedValueOnce({
      results: Array.from({ length: 6 }, (_, i) => ({
        title: `Item ${i}`,
        thumbnail: `https://thumbs.example.com/${i}.jpg`,
        image: `https://example.com/${i}.jpg`,
        url: `https://example.com/${i}`,
      })),
    });

    const results = await searchImages("test", 4);
    expect(results).toHaveLength(4);
  });

  it("resolves alphanumeric vqd tokens", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      "<html><script>vqd='4-abc123_xyz~99'</script></html>"
    );
    vi.mocked(fetchJson).mockResolvedValueOnce({
      results: [
        {
          title: "Arc",
          thumbnail: "https://thumbs.example.com/arc.jpg",
          image: "https://example.com/arc.jpg",
        },
      ],
    });

    const results = await searchImages("Arc");
    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining("vqd=4-abc123_xyz~99"),
      1
    );
    expect(results).toHaveLength(1);
  });

  it("returns empty array when vqd token is missing", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce("<html>no token here</html>");

    const results = await searchImages("Arc Browser");
    expect(results).toEqual([]);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("returns empty array when the image api fails", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce("<html>vqd=4-999</html>");
    vi.mocked(fetchJson).mockRejectedValueOnce(new Error("blocked"));

    const results = await searchImages("Arc Browser");
    expect(results).toEqual([]);
  });

  it("returns empty array when the search page fails", async () => {
    vi.mocked(fetchHtml).mockRejectedValueOnce(new Error("network"));

    const results = await searchImages("Arc Browser");
    expect(results).toEqual([]);
  });
});

describe("buildImageSelectionPrompt", () => {
  it("includes the query and JSON instruction", () => {
    const prompt = buildImageSelectionPrompt("Arc Browser");
    expect(prompt).toContain("Arc Browser");
    expect(prompt).toContain('"index"');
    expect(prompt).toContain("JSON");
  });
});

describe("selectBestImage", () => {
  it("returns null when there are no candidates", async () => {
    const result = await selectBestImage(mockModel, "Arc Browser", []);
    expect(result).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns the first candidate without a model", async () => {
    const result = await selectBestImage(null, "Arc Browser", [candidate()]);
    expect(result).toEqual(candidate());
    expect(generateText).not.toHaveBeenCalled();
  });

  it("uploads fetched images to the vision model and returns the chosen index", async () => {
    const candidates = [
      candidate({ thumbnail: "https://thumbs.example.com/0.jpg" }),
      candidate({ thumbnail: "https://thumbs.example.com/1.jpg", title: "Arc 2" }),
    ];
    vi.mocked(fetchBinary)
      .mockResolvedValueOnce({ data: new Uint8Array([1]), mimeType: "image/jpeg" })
      .mockResolvedValueOnce({ data: new Uint8Array([2]), mimeType: "image/png" });
    vi.mocked(generateText).mockResolvedValueOnce({ text: '{"index":1}' } as never);

    const result = await selectBestImage(mockModel, "Arc Browser", candidates);

    expect(result).toBe(candidates[1]);
    const callArgs = vi.mocked(generateText).mock.calls[0][0] as {
      messages: Array<{ role: string; content: Array<{ type: string; image?: Uint8Array; mimeType?: string }> }>;
      maxTokens: number;
    };
    expect(callArgs.maxTokens).toBe(32);
    const parts = callArgs.messages[0].content;
    expect(parts[0].type).toBe("text");
    expect(parts).toHaveLength(3);
    expect(parts[1]).toMatchObject({ type: "image", mimeType: "image/jpeg" });
    expect(parts[1].image).toBeInstanceOf(Uint8Array);
    expect(parts[2]).toMatchObject({ type: "image", mimeType: "image/png" });
  });

  it("caps the number of uploaded images", async () => {
    const candidates = Array.from({ length: 5 }, (_, i) => candidate({ thumbnail: `https://thumbs.example.com/${i}.jpg` }));
    vi.mocked(fetchBinary).mockResolvedValue({ data: new Uint8Array([1]), mimeType: "image/jpeg" });
    vi.mocked(generateText).mockResolvedValueOnce({ text: '{"index":0}' } as never);

    await selectBestImage(mockModel, "Arc Browser", candidates, 3);

    expect(fetchBinary).toHaveBeenCalledTimes(3);
    const callArgs = vi.mocked(generateText).mock.calls[0][0] as {
      messages: Array<{ content: unknown[] }>;
    };
    expect(callArgs.messages[0].content).toHaveLength(4);
  });

  it("falls back to the first fetched candidate when the model reply is not JSON", async () => {
    const candidates = [candidate(), candidate({ title: "Other" })];
    vi.mocked(fetchBinary).mockResolvedValue({ data: new Uint8Array([1]), mimeType: "image/jpeg" });
    vi.mocked(generateText).mockResolvedValueOnce({ text: "I like the second one" } as never);

    const result = await selectBestImage(mockModel, "Arc Browser", candidates);
    expect(result).toBe(candidates[0]);
  });

  it("falls back to the first fetched candidate when the index is out of range", async () => {
    const candidates = [candidate(), candidate({ title: "Other" })];
    vi.mocked(fetchBinary).mockResolvedValue({ data: new Uint8Array([1]), mimeType: "image/jpeg" });
    vi.mocked(generateText).mockResolvedValueOnce({ text: '{"index":99}' } as never);

    const result = await selectBestImage(mockModel, "Arc Browser", candidates);
    expect(result).toBe(candidates[0]);
  });

  it("falls back when the vision call throws", async () => {
    const candidates = [candidate(), candidate({ title: "Other" })];
    vi.mocked(fetchBinary).mockResolvedValue({ data: new Uint8Array([1]), mimeType: "image/jpeg" });
    vi.mocked(generateText).mockRejectedValueOnce(new Error("api down"));

    const result = await selectBestImage(mockModel, "Arc Browser", candidates);
    expect(result).toBe(candidates[0]);
  });

  it("skips candidates whose image could not be fetched", async () => {
    const candidates = [
      candidate({ thumbnail: "https://thumbs.example.com/broken.jpg" }),
      candidate({ thumbnail: "https://thumbs.example.com/ok.jpg", title: "Good" }),
    ];
    vi.mocked(fetchBinary)
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValueOnce({ data: new Uint8Array([2]), mimeType: "image/jpeg" });
    vi.mocked(generateText).mockResolvedValueOnce({ text: '{"index":0}' } as never);

    const result = await selectBestImage(mockModel, "Arc Browser", candidates);

    expect(result).toBe(candidates[1]);
    expect(fetchBinary).toHaveBeenCalledTimes(2);
  });

  it("falls back when no image could be fetched", async () => {
    const candidates = [candidate()];
    vi.mocked(fetchBinary).mockRejectedValueOnce(new Error("404"));

    const result = await selectBestImage(mockModel, "Arc Browser", candidates);
    expect(result).toBe(candidates[0]);
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("extractOpenGraphImage", () => {
  it("extracts og:image with property before content", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta property="og:image" content="https://example.com/img.jpg"/></head></html>'
    );
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBe("https://example.com/img.jpg");
    expect(fetchHtml).toHaveBeenCalledWith("https://example.com/page", 2);
  });

  it("extracts og:image with content before property", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta content="https://example.com/img.jpg" property="og:image"/></head></html>'
    );
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBe("https://example.com/img.jpg");
  });

  it("extracts og:image with single quotes", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      "<html><head><meta property='og:image' content='https://example.com/single.jpg'/></head></html>"
    );
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBe("https://example.com/single.jpg");
  });

  it("falls back to twitter:image", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta name="twitter:image" content="https://example.com/tw.jpg"/></head></html>'
    );
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBe("https://example.com/tw.jpg");
  });

  it("resolves relative image URLs against the page URL", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta property="og:image" content="/img/rel.jpg"/></head></html>'
    );
    const result = await extractOpenGraphImage("https://example.com/deep/page");
    expect(result).toBe("https://example.com/img/rel.jpg");
  });

  it("resolves protocol-relative image URLs", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta property="og:image" content="//cdn.example.com/x.jpg"/></head></html>'
    );
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBe("https://cdn.example.com/x.jpg");
  });

  it("returns null when no image meta exists", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce("<html><head></head></html>");
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBeNull();
  });

  it("returns null when the page fetch fails", async () => {
    vi.mocked(fetchHtml).mockRejectedValueOnce(new Error("blocked"));
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBeNull();
  });

  it("rejects non-http image URLs", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta property="og:image" content="data:image/png;base64,abc"/></head></html>'
    );
    const result = await extractOpenGraphImage("https://example.com/page");
    expect(result).toBeNull();
  });
});

describe("getRepoPreviewImage", () => {
  it("builds the repo preview URL from a plain repo URL", () => {
    expect(getRepoPreviewImage("https://github.com/vercel/next.js")).toBe(
      "https://opengraph.githubassets.com/1/vercel/next.js"
    );
  });

  it("strips .git suffix", () => {
    expect(getRepoPreviewImage("https://github.com/vercel/next.js.git")).toBe(
      "https://opengraph.githubassets.com/1/vercel/next.js"
    );
  });

  it("strips sub-paths like /tree or /blob", () => {
    expect(getRepoPreviewImage("https://github.com/vercel/next.js/tree/main")).toBe(
      "https://opengraph.githubassets.com/1/vercel/next.js"
    );
    expect(getRepoPreviewImage("https://github.com/vercel/next.js/blob/main/pages/index.js")).toBe(
      "https://opengraph.githubassets.com/1/vercel/next.js"
    );
  });

  it("strips trailing slash, query and hash", () => {
    expect(getRepoPreviewImage("https://github.com/vercel/next.js/?tab=readme#top")).toBe(
      "https://opengraph.githubassets.com/1/vercel/next.js"
    );
  });

  it("returns null for non-GitHub or malformed URLs", () => {
    expect(getRepoPreviewImage("https://github.com/vercel")).toBeNull();
    expect(getRepoPreviewImage("https://example.com/vercel/next.js")).toBeNull();
    expect(getRepoPreviewImage("not-a-url")).toBeNull();
  });
});

describe("isImageUrlFetchable", () => {
  it("returns true when the binary fetch succeeds", async () => {
    vi.mocked(fetchBinary).mockResolvedValueOnce({
      data: new Uint8Array([1]),
      mimeType: "image/jpeg",
    });
    await expect(isImageUrlFetchable("https://example.com/img.jpg")).resolves.toBe(true);
  });

  it("returns false when the fetch fails", async () => {
    vi.mocked(fetchBinary).mockRejectedValueOnce(new Error("404"));
    await expect(isImageUrlFetchable("https://example.com/img.jpg")).resolves.toBe(false);
  });
});

describe("resolveItemImage", () => {
  it("uses the GitHub repo preview card without fetching", async () => {
    const result = await resolveItemImage("https://github.com/vercel/next.js");
    expect(result).toBe("https://opengraph.githubassets.com/1/vercel/next.js");
    expect(fetchBinary).not.toHaveBeenCalled();
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it("extracts and verifies the page og:image", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta property="og:image" content="https://example.com/img.jpg"/></head></html>'
    );
    vi.mocked(fetchBinary).mockResolvedValueOnce({
      data: new Uint8Array([1]),
      mimeType: "image/png",
    });
    const result = await resolveItemImage("https://example.com/product");
    expect(result).toBe("https://example.com/img.jpg");
    expect(fetchBinary).toHaveBeenCalledWith("https://example.com/img.jpg", expect.any(Number));
  });

  it("returns null when the og:image is not fetchable", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce(
      '<html><head><meta property="og:image" content="https://example.com/img.jpg"/></head></html>'
    );
    vi.mocked(fetchBinary).mockRejectedValueOnce(new Error("blocked"));
    const result = await resolveItemImage("https://example.com/product");
    expect(result).toBeNull();
  });

  it("returns null when no og:image exists on the page", async () => {
    vi.mocked(fetchHtml).mockResolvedValueOnce("<html><head></head></html>");
    const result = await resolveItemImage("https://example.com/product");
    expect(result).toBeNull();
  });
});

describe("extractItemUrlByName", () => {
  it("matches against the name field and returns the link", () => {
    const items = [{ name: "Arc Browser", link: "https://ph.example.com/arc" }];
    expect(extractItemUrlByName(items, "Arc Browser")).toBe("https://ph.example.com/arc");
  });

  it("matches against the title field and returns the url", () => {
    const items = [{ title: "Kagi", url: "https://kagi.com" }];
    expect(extractItemUrlByName(items, "Kagi")).toBe("https://kagi.com");
  });

  it("matches GitHub items by owner/repo", () => {
    const items = [{ owner: "obra", repo: "superpowers", link: "https://github.com/obra/superpowers" }];
    expect(extractItemUrlByName(items, "obra/superpowers")).toBe(
      "https://github.com/obra/superpowers"
    );
  });

  it("matches GitHub items by repo name only", () => {
    const items = [{ owner: "obra", repo: "superpowers", link: "https://github.com/obra/superpowers" }];
    expect(extractItemUrlByName(items, "superpowers")).toBe(
      "https://github.com/obra/superpowers"
    );
  });

  it("matches case-insensitively", () => {
    const items = [{ name: "Arc Browser", link: "https://ph.example.com/arc" }];
    expect(extractItemUrlByName(items, "arc browser")).toBe("https://ph.example.com/arc");
  });

  it("matches when one name contains the other", () => {
    const items = [{ name: "Google Antigravity IDE Extensions", link: "https://ph.example.com/antigravity" }];
    expect(extractItemUrlByName(items, "Google Antigravity")).toBe("https://ph.example.com/antigravity");
  });

  it("flattens nested arrays from per-task raw data", () => {
    const items = [[{ name: "Arc Browser", link: "https://ph.example.com/arc" }]];
    expect(extractItemUrlByName(items, "Arc Browser")).toBe("https://ph.example.com/arc");
  });

  it("returns undefined when nothing matches", () => {
    const items = [{ name: "Arc Browser", link: "https://ph.example.com/arc" }];
    expect(extractItemUrlByName(items, "Nope")).toBeUndefined();
    expect(extractItemUrlByName([], "Anything")).toBeUndefined();
  });

  it("ignores malformed items and non-http urls", () => {
    const items = [
      null,
      "string",
      42,
      { name: "Arc", link: "javascript:alert(1)" },
      { name: "Zed", link: "not-a-url" },
    ];
    expect(extractItemUrlByName(items, "Arc")).toBeUndefined();
    expect(extractItemUrlByName(items, "Zed")).toBeUndefined();
  });
});

describe("extractLinkByName", () => {
  it("extracts the matching markdown link", () => {
    const md = "- [AI] [Arc Browser](https://arc.net) — a browser";
    expect(extractLinkByName(md, "Arc Browser")).toBe("https://arc.net");
  });

  it("matches case-insensitively", () => {
    const md = "- [AI] [Arc Browser](https://arc.net)";
    expect(extractLinkByName(md, "arc browser")).toBe("https://arc.net");
  });

  it("returns undefined when no link matches", () => {
    const md = "- [AI] [Arc Browser](https://arc.net)";
    expect(extractLinkByName(md, "Other")).toBeUndefined();
    expect(extractLinkByName("", "Arc Browser")).toBeUndefined();
  });
});
