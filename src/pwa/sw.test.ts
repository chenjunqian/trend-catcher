import { describe, it, expect } from "vitest";
import { swCode } from "./sw";

describe("service worker", () => {
  it("contains a valid cache name", () => {
    expect(swCode).toContain('const CACHE = "trend-catcher-v1"');
  });

  it("listens for install event", () => {
    expect(swCode).toContain('self.addEventListener("install"');
  });

  it("listens for activate event", () => {
    expect(swCode).toContain('self.addEventListener("activate"');
  });

  it("listens for fetch event", () => {
    expect(swCode).toContain('self.addEventListener("fetch"');
  });

  it("skips waiting on install", () => {
    expect(swCode).toContain("self.skipWaiting()");
  });

  it("claims clients on activate", () => {
    expect(swCode).toContain("self.clients.claim()");
  });

  it("caches the offline page", () => {
    expect(swCode).toContain('"/offline"');
  });

  it("caches the root page", () => {
    expect(swCode).toContain('"/"');
  });

  it("caches the manifest", () => {
    expect(swCode).toContain('"/manifest.json"');
  });
});
