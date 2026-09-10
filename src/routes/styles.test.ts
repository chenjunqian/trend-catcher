import { describe, it, expect } from "vitest";
import { KAMI_TOKENS, LAYOUT_STYLES, STANDALONE_STYLES } from "./styles";

describe("kami style tokens", () => {
  it("defines parchment, ivory and ink-blue brand tokens", () => {
    expect(KAMI_TOKENS).toContain("--parchment: #f5f4ed");
    expect(KAMI_TOKENS).toContain("--ivory: #faf9f5");
    expect(KAMI_TOKENS).toContain("--brand: #1B365D");
    expect(KAMI_TOKENS).toContain("--brand-light: #2D5A8A");
  });

  it("does not carry the retired newspaper palette", () => {
    expect(KAMI_TOKENS).not.toContain("#fdfcf8");
    expect(KAMI_TOKENS).not.toContain("#b03a2e");
    expect(KAMI_TOKENS).not.toContain("#1a1a1a");
  });

  it("declares both TsangerJinKai02 weights as woff2", () => {
    expect(KAMI_TOKENS).toContain("TsangerJinKai02-W04.woff2");
    expect(KAMI_TOKENS).toContain("TsangerJinKai02-W05.woff2");
    expect(KAMI_TOKENS).toContain('format("woff2")');
  });

  it("keeps a CJK serif fallback chain", () => {
    expect(KAMI_TOKENS).toContain("Source Han Serif SC");
    expect(KAMI_TOKENS).toContain("Songti SC");
  });

  it("locks font synthesis off", () => {
    expect(KAMI_TOKENS).toContain("font-synthesis: none");
  });

  it("exposes layout and standalone style layers", () => {
    expect(LAYOUT_STYLES).toContain(".site-header");
    expect(LAYOUT_STYLES).toContain(".entry");
    expect(STANDALONE_STYLES).toContain(".panel");
  });
});
