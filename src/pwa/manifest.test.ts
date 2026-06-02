import { describe, it, expect } from "vitest";
import { manifest } from "./manifest";

describe("manifest", () => {
  it("has a name", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.name.length).toBeGreaterThan(5);
  });

  it("has a short_name", () => {
    expect(manifest.short_name).toBe("Trend Catcher");
  });

  it("has start_url pointing to root", () => {
    expect(manifest.start_url).toBe("/");
  });

  it("is configured as standalone display", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("has theme_color set", () => {
    expect(manifest.theme_color).toBe("#000000");
  });

  it("has background_color set", () => {
    expect(manifest.background_color).toBe("#000000");
  });

  it("has at least one icon", () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
  });

  it("icons have required fields", () => {
    for (const icon of manifest.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  it("has a 192x192 PNG icon", () => {
    const icon192 = manifest.icons.find((i) => i.sizes === "192x192");
    expect(icon192).toBeTruthy();
    expect(icon192!.src).toContain(".png");
  });

  it("has a 512x512 PNG icon", () => {
    const icon512 = manifest.icons.find((i) => i.sizes === "512x512");
    expect(icon512).toBeTruthy();
  });
});
