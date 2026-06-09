import type { FC } from "hono/jsx";
import type { DailySummary, WeeklySummary } from "../db/client";
import type { Lang } from "../i18n";
import { t, switchLang } from "../i18n";
import type { SiteSummaryEntry } from "../aggregator/tools";
import Layout from "./layout";
import { renderMarkdown } from "./markdown";

interface ReportProps {
  summary: DailySummary | WeeklySummary;
  lang: Lang;
  path: string;
  isWeekly?: boolean;
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

function getReportDate(summary: DailySummary | WeeklySummary, isWeekly?: boolean): string {
  if (isWeekly) return (summary as WeeklySummary).week_start_date;
  return (summary as DailySummary).summary_date;
}

const Report: FC<ReportProps> = ({ summary, lang, path, isWeekly }) => {
  const siteSummaries = parseSiteSummaries(summary.site_summaries);
  const altLang = switchLang(lang);
  const displayDate = getReportDate(summary, isWeekly);

  return (
    <Layout title={`${displayDate}`} lang={lang} path={path}>
      <a href={`/?lang=${lang}`} class="back-link">
        {t(lang, "report.back")}
      </a>

      <h2 style={{ fontSize: "22px", marginBottom: "16px" }}>
        {displayDate} {t(lang, isWeekly ? "report.weekly_heading" : "report.heading")}
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
              <ReportContent html={renderMarkdown(lang === "zh" ? entry.zh : entry.en)} />
            </div>
          ))}
        </div>
      )}

      <div class="report">
        {lang === "en" && (
          <div class="lang-section">
            <h2>
              {t(lang, "report.overall")}
            </h2>
            {summary.full_report_en ? (
              <ReportContent html={renderMarkdown(summary.full_report_en)} />
            ) : (
              <p style="color: #999;">{t(lang, "report.empty")}</p>
            )}
          </div>
        )}

        {lang === "zh" && (
          <div class="lang-section">
            <h2>
              {t(lang, "report.overall")}
            </h2>
            {summary.full_report_zh ? (
              <ReportContent html={renderMarkdown(summary.full_report_zh)} />
            ) : (
              <p style="color: #999;">{t(lang, "report.empty")}</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

const ReportContent: FC<{ html: string }> = ({ html }) => (
  <div dangerouslySetInnerHTML={{ __html: html }} />
);

export default Report;
