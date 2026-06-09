import { describe, it, expect } from "vitest";
import { t, detectLang, switchLang } from "./index";

describe("t", () => {
  it("returns English text for en lang", () => {
    expect(t("en", "site.title")).toBe("Trend Catcher");
  });

  it("returns Chinese text for zh lang", () => {
    expect(t("zh", "site.title")).toBe("猎趋");
  });

  it("falls back to English for unknown key", () => {
    expect(t("en", "nonexistent.key")).toBe("nonexistent.key");
  });

  it("falls back to English for unknown lang", () => {
    expect(t("xx" as "en", "site.title")).toBe("Trend Catcher");
  });

  it("footer key exists in both languages", () => {
    expect(t("en", "footer")).toBeTruthy();
    expect(t("zh", "footer")).toBeTruthy();
  });

  it("all en keys have zh counterparts", () => {
    const enKeys = [
      "site.title", "home.heading", "home.empty", "report.back",
      "report.heading", "report.site_summaries", "report.overall",
      "report.empty", "badge.daily", "footer",
    ];
    for (const key of enKeys) {
      expect(t("zh", key)).not.toBe(key);
      expect(t("zh", key)).toBeTruthy();
    }
  });
});

describe("t with template params", () => {
  it("replaces {key} placeholders with values", () => {
    expect(t("en", "report.week_label", { date: "2026-06-01" })).toContain("2026-06-01");
    expect(t("zh", "report.week_label", { date: "2026-06-01" })).toContain("2026-06-01");
  });

  it("preserves unmatched placeholders", () => {
    expect(t("en", "email.subject")).toContain("{date}");
  });

  it("does not break when no params provided", () => {
    expect(t("en", "report.week_label")).toBeTruthy();
  });

  it("works with unknown key and params", () => {
    expect(t("en", "nonexistent.key", { foo: "bar" })).toBe("nonexistent.key");
  });
});

describe("weekly i18n keys", () => {
  it("badge.weekly exists in both languages", () => {
    expect(t("en", "badge.weekly")).toBe("Weekly");
    expect(t("zh", "badge.weekly")).toBe("周报");
  });

  it("report.weekly_heading exists in both languages", () => {
    expect(t("en", "report.weekly_heading")).toBe("Weekly Trend Report");
    expect(t("zh", "report.weekly_heading")).toBe("每周趋势报告");
  });

  it("email.subject.weekly exists in both languages", () => {
    expect(t("en", "email.subject.weekly")).toContain("Weekly");
    expect(t("zh", "email.subject.weekly")).toContain("周报");
  });

  it("report.week_label exists in both languages", () => {
    expect(t("en", "report.week_label")).toContain("{date}");
    expect(t("zh", "report.week_label")).toContain("{date}");
  });
});

describe("detectLang", () => {
  function makeRequest(url: string, acceptLang?: string): Request {
    const headers = new Headers();
    if (acceptLang) headers.set("Accept-Language", acceptLang);
    return new Request(url, { headers });
  }

  it("returns zh from ?lang=zh query param", () => {
    const req = makeRequest("http://localhost/?lang=zh");
    expect(detectLang(req)).toBe("zh");
  });

  it("returns en from ?lang=en query param", () => {
    const req = makeRequest("http://localhost/?lang=en");
    expect(detectLang(req)).toBe("en");
  });

  it("returns zh from Accept-Language header", () => {
    const req = makeRequest("http://localhost/", "zh-CN,zh;q=0.9");
    expect(detectLang(req)).toBe("zh");
  });

  it("returns en as default when neither param nor header present", () => {
    const req = makeRequest("http://localhost/");
    expect(detectLang(req)).toBe("en");
  });

  it("query param takes precedence over header", () => {
    const req = makeRequest("http://localhost/?lang=en", "zh-CN,zh;q=0.9");
    expect(detectLang(req)).toBe("en");
  });
});

describe("switchLang", () => {
  it("switches en to zh", () => {
    expect(switchLang("en")).toBe("zh");
  });

  it("switches zh to en", () => {
    expect(switchLang("zh")).toBe("en");
  });
});
