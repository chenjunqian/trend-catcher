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
    "badge.weekly": "Weekly",
    "footer": "Powered by Cloudflare Workers & AI",
    "site.producthunt": "Product Hunt",
    "site.hackernews": "Hacker News",
    "site.github": "GitHub Trending",
    "email.subject": "Trend Catcher Daily — {date}",
    "email.subject.weekly": "Trend Catcher Weekly — {date}",
    "email.source_en": "English Report",
    "email.source_zh": "Chinese Report",
    "lang.switch": "中文",
    "home.heading_weekly": "Weekly Trend Report",
    "report.weekly_heading": "Weekly Trend Report",
    "report.week_label": "Week of {date}",
    "newsletter.placeholder": "Enter email for updates",
    "newsletter.subscribe": "Subscribe",
    "newsletter.sub_success": "Check your email to confirm!",
    "newsletter.already_exists": "Email already subscribed",
    "newsletter.invalid_email": "Please enter a valid email",
    "newsletter.confirm.title": "Subscription Confirmed",
    "newsletter.confirm.body": "Thanks for subscribing! You will receive daily and weekly trend reports.",
    "newsletter.confirm.home": "Back to home",
    "newsletter.unsubscribe.title": "Unsubscribe",
    "newsletter.unsubscribe.text": "Are you sure you want to unsubscribe from Trend Catcher newsletters?",
    "newsletter.unsubscribe.button": "Unsubscribe",
    "newsletter.unsubscribe.success": "You have been unsubscribed. We will miss you!",
    "newsletter.not_found": "Invalid or expired link",
    "email.unsubscribe_link": "Unsubscribe",
    "email.confirm_subject": "Confirm your Trend Catcher subscription / 确认订阅猎趋",
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
    "badge.weekly": "周报",
    "footer": "由 Cloudflare Workers 和 AI 驱动",
    "site.producthunt": "Product Hunt",
    "site.hackernews": "Hacker News",
    "site.github": "GitHub Trending",
    "email.subject": "猎趋日报 — {date}",
    "email.subject.weekly": "猎趋周报 — {date}",
    "email.source_en": "英文报告",
    "email.source_zh": "中文报告",
    "lang.switch": "English",
    "home.heading_weekly": "每周趋势报告",
    "report.weekly_heading": "每周趋势报告",
    "report.week_label": "{date} 所在周",
    "newsletter.placeholder": "输入邮箱订阅更新",
    "newsletter.subscribe": "订阅",
    "newsletter.sub_success": "请查收邮件确认订阅！",
    "newsletter.already_exists": "该邮箱已订阅",
    "newsletter.invalid_email": "请输入有效邮箱",
    "newsletter.confirm.title": "订阅已确认",
    "newsletter.confirm.body": "感谢订阅！您将收到每日和每周趋势报告。",
    "newsletter.confirm.home": "返回首页",
    "newsletter.unsubscribe.title": "取消订阅",
    "newsletter.unsubscribe.text": "确认取消订阅猎趋新闻邮件？",
    "newsletter.unsubscribe.button": "确认取消订阅",
    "newsletter.unsubscribe.success": "已成功取消订阅，后会有期！",
    "newsletter.not_found": "链接无效或已过期",
    "email.unsubscribe_link": "取消订阅",
    "email.confirm_subject": "确认你的猎趋订阅 / Confirm your Trend Catcher subscription",
  },
};

export function t(lang: Lang, key: string, params?: Record<string, string>): string {
  let text = translations[lang]?.[key] ?? translations["en"]?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
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
