import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FONT_CHUNKS } from "./font-chunks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(__dirname, "../../public/fonts");

function parseRanges(value: string): Array<[number, number]> {
  return value.split(",").map((part) => {
    const [start, end] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(start, 16), end ? parseInt(end, 16) : parseInt(start, 16)];
  });
}

describe("font chunks", () => {
  it("references a woff2 pair per chunk", () => {
    expect(FONT_CHUNKS.length).toBeGreaterThan(10);
    for (const [index, chunk] of FONT_CHUNKS.entries()) {
      const id = String(index).padStart(3, "0");
      expect(chunk.w04).toBe(`/fonts/TsangerJinKai02-W04-${id}.woff2`);
      expect(chunk.w05).toBe(`/fonts/TsangerJinKai02-W05-${id}.woff2`);
      expect(chunk.unicodeRange.length).toBeGreaterThan(0);
    }
  });

  it("ships every referenced chunk file and nothing else", () => {
    const files = readdirSync(FONT_DIR)
      .filter((name) => name.endsWith(".woff2"))
      .sort();
    const referenced = FONT_CHUNKS.flatMap((chunk) => [
      chunk.w04.split("/").pop(),
      chunk.w05.split("/").pop(),
    ]).sort();
    expect(files).toEqual(referenced);
  });

  it("keeps each chunk small enough to fetch on demand", () => {
    for (const name of readdirSync(FONT_DIR).filter((n) => n.endsWith(".woff2"))) {
      const size = statSync(resolve(FONT_DIR, name)).size;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(64 * 1024);
    }
  });

  it("assigns each codepoint to exactly one chunk", () => {
    const seen = new Map<number, number>();
    for (const [index, chunk] of FONT_CHUNKS.entries()) {
      for (const [start, end] of parseRanges(chunk.unicodeRange)) {
        for (let cp = start; cp <= end; cp++) {
          expect(seen.has(cp)).toBe(false);
          seen.set(cp, index);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(1000);
  });

  it("puts the most frequent characters in the first chunk", () => {
    const covered = new Set<number>();
    for (const [start, end] of parseRanges(FONT_CHUNKS[0].unicodeRange)) {
      for (let cp = start; cp <= end; cp++) covered.add(cp);
    }
    for (const char of ["的", "一", "是"]) {
      expect(covered.has(char.codePointAt(0)!)).toBe(true);
    }
  });
});
