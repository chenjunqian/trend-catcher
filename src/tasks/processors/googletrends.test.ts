import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchGoogleAutocomplete } from "./googletrends";

describe("fetchGoogleAutocomplete", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns suggestions list from Google Autocomplete API", async () => {
    const mockResponse = [
      "nextjs",
      ["nextjs 16", "nextjs vs react", "nextjs alternative", "nextjs tutorial"],
      ["", "", "", ""],
      [],
    ];

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("nextjs");
    expect(suggestions).toEqual([
      "nextjs 16",
      "nextjs vs react",
      "nextjs alternative",
      "nextjs tutorial",
    ]);
  });

  it("returns empty array for empty or whitespace query without fetching", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof globalThis.fetch;

    expect(await fetchGoogleAutocomplete("")).toEqual([]);
    expect(await fetchGoogleAutocomplete("   ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles empty suggestions gracefully", async () => {
    const mockResponse = ["xyzrandomtermnotfound", []];

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("xyzrandomtermnotfound");
    expect(suggestions).toEqual([]);
  });

  it("limits suggestions to maximum 10 items", async () => {
    const rawSuggestions = Array.from({ length: 15 }, (_, i) => `item ${i}`);
    const mockResponse = ["test", rawSuggestions];

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("test");
    expect(suggestions).toHaveLength(10);
  });

  it("handles network error gracefully and returns empty array", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.reject(new Error("Network error"))
    ) as typeof globalThis.fetch;

    const suggestions = await fetchGoogleAutocomplete("failing");
    expect(suggestions).toEqual([]);
  });
});
