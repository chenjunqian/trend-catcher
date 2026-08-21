import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBinary } from "./fetcher";

function stubFetch(response: Response | Error) {
  const fn =
    typeof response === "object" && response instanceof Response
      ? vi.fn().mockResolvedValue(response)
      : vi.fn().mockRejectedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBinary", () => {
  it("returns bytes and mime type for an image response", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const fetchMock = stubFetch(
      new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    );

    const result = await fetchBinary("https://example.com/img.png");

    expect(result.mimeType).toBe("image/png");
    expect(Array.from(result.data)).toEqual([137, 80, 78, 71]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/img.png",
      expect.anything()
    );
  });

  it("rejects non-image content types", async () => {
    stubFetch(
      new Response("<html>not an image</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })
    );

    await expect(fetchBinary("https://example.com/page")).rejects.toThrow(
      /Not an image/
    );
  });

  it("rejects bodies larger than maxBytes", async () => {
    const big = new Uint8Array(1024 * 1024 * 2);
    stubFetch(
      new Response(big, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    );

    await expect(
      fetchBinary("https://example.com/big.jpg", 1024 * 1024)
    ).rejects.toThrow(/too large/);
  });

  it("strips parameters from the mime type", async () => {
    stubFetch(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg; charset=binary" },
      })
    );

    const result = await fetchBinary("https://example.com/a.jpg");
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("propagates network failures after retries are exhausted", async () => {
    stubFetch(new Error("boom"));
    const fetchMock = vi.mocked(fetch);

    await expect(fetchBinary("https://example.com/x.jpg", 4096, 1)).rejects.toThrow(
      /Failed after 1 attempts/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
