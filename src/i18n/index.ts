export type Lang = "en" | "zh";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    "site.title": "Trend Catcher",
    "site.subtitle": "Daily Trend Reports",
    "nav.home": "Home",
    "nav.reports": "Reports",
    "home.heading": "Daily Trend Reports",
    "home.empty": "No reports yet. The system auto-generates reports daily at UTC 1:00.",
    "report.back": "← Back to reports",
    "report.heading": "Daily Trend Report",
    "report.site_summaries": "Site Summaries",
    "report.overall": "Overall Trend Report",
    "report.empty": "Report content is empty",
    "badge.daily": "Daily",
    "footer": "Powered by Cloudflare Workers & AI",
    "site.producthunt": "Product Hunt",
    "site.hackernews": "Hacker News",
    "site.github": "GitHub Trending",
    "email.subject": "Trend Catcher Daily — {date}",
    "email.source_en": "English Report",
    "email.source_zh": "Chinese Report",
    "lang.switch": "中文",
  },
  zh: {
    "site.title": "猎趋",
    "site.subtitle": "每日趋势日报",
    "nav.home": "首页",
    "nav.reports": "报告",
    "home.heading": "每日趋势报告",
    "home.empty": "暂无日报数据。系统每天 UTC 1:00 自动生成。",
    "report.back": "← 返回日报列表",
    "report.heading": "每日趋势报告",
    "report.site_summaries": "各站摘要",
    "report.overall": "整体趋势报告",
    "report.empty": "报告内容为空",
    "badge.daily": "日报",
    "footer": "由 Cloudflare Workers 和 AI 驱动",
    "site.producthunt": "Product Hunt",
    "site.hackernews": "Hacker News",
    "site.github": "GitHub Trending",
    "email.subject": "猎趋日报 — {date}",
    "email.source_en": "英文报告",
    "email.source_zh": "中文报告",
    "lang.switch": "English",
  },
};

export function t(lang: Lang, key: string): string {
  return translations[lang]?.[key] ?? translations["en"]?.[key] ?? key;
}

export function detectLang(request: Request): Lang {
  const url = new URL(request.url);
  const query = url.searchParams.get("lang");
  if (query === "zh" || query === "en") return query;

  const acceptLang = request.headers.get("Accept-Language") || "";
  if (acceptLang.includes("zh")) return "zh";

  return "en";
}

export function switchLang(current: Lang): Lang {
  return current === "en" ? "zh" : "en";
}
