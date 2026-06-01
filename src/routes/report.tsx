import type { FC } from "hono/jsx";
import type { DailySummary } from "../db/client";
import type { Lang } from "../i18n";
import { t, switchLang } from "../i18n";
import type { SiteSummaryEntry } from "../aggregator/tools";
import Layout from "./layout";

interface ReportProps {
  summary: DailySummary;
  lang: Lang;
}

function parseSiteSummaries(raw: string): Record<string, SiteSummaryEntry> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const SITE_LABELS: Record<string, string> = {
  producthunt: "Product Hunt",
  hackernews: "Hacker News",
  github: "GitHub Trending",
};

const Report: FC<ReportProps> = ({ summary, lang }) => {
  const siteSummaries = parseSiteSummaries(summary.site_summaries);
  const altLang = switchLang(lang);

  return (
    <Layout title={`${summary.summary_date}`} lang={lang}>
      <a href={`/?lang=${lang}`} class="back-link">
        {t(lang, "report.back")}
      </a>

      <h2 style={{ fontSize: "22px", marginBottom: "16px" }}>
        {summary.summary_date} {t(lang, "report.heading")}
      </h2>

      {Object.keys(siteSummaries).length > 0 && (
        <div>
          <h3 style={{ fontSize: "18px", marginBottom: "12px" }}>
            {t(lang, "report.site_summaries")}
          </h3>
          {Object.entries(siteSummaries).map(([website, entry]) => (
            <div class="card" key={website}>
              <h3>
                {SITE_LABELS[website] || website}
                <span class="badge" style="margin-left: 8px;">
                  {website}
                </span>
              </h3>
              <p>{lang === "zh" ? entry.zh : entry.en}</p>
            </div>
          ))}
        </div>
      )}

      <div class="report">
        <div class="lang-section">
          <h2>
            {t(lang, "report.overall")} (English)
          </h2>
          {summary.full_report_en ? (
            <ReportContent html={renderMarkdown(summary.full_report_en)} />
          ) : (
            <p style="color: #8b949e;">{t(lang, "report.empty")}</p>
          )}
        </div>

        <div class="lang-section">
          <h2>
            {t(lang, "report.overall")} (中文)
          </h2>
          {summary.full_report_zh ? (
            <ReportContent html={renderMarkdown(summary.full_report_zh)} />
          ) : (
            <p style="color: #8b949e;">{t(lang, "report.empty")}</p>
          )}
        </div>
      </div>
    </Layout>
  );
};

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "\n<li>")
    .replace(/(<li>.*?)\n/g, "$1</li>\n")
    .replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[a-z/])(.+)$/gm, "<p>$1</p>")
    .replace(/<\/ul><p><\/p><ul>/g, "</ul><ul>")
    .replace(/<\/ul>\s*<p>\s*<\/p>\s*<ul>/g, "</ul><ul>")
    .replace(/<p><\/p>/g, "");
}

const ReportContent: FC<{ html: string }> = ({ html }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} />
);

export default Report;
