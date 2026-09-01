import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchHtml } from "./fetcher";

describe("fetchHtml", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns html text on successful fetch", async () => {
    const mockResponse = new Response("<html>hello</html>", { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const html = await fetchHtml("https://example.com", 1, 8000);
    expect(html).toBe("<html>hello</html>");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
