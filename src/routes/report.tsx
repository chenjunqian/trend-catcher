import type { FC } from "hono/jsx";
import type { DailySummary, WeeklySummary } from "../db/client";
import type { Lang } from "../i18n";
import { t } from "../i18n";
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
  const displayDate = getReportDate(summary, isWeekly);

  return (
    <Layout title={`${displayDate}`} lang={lang} path={path}>
      <a href={`/?lang=${lang}`} class="back-link">
        {t(lang, "report.back")}
      </a>

      <header class="report-head">
        <p class="eyebrow">
          {t(lang, isWeekly ? "report.weekly_heading" : "report.heading")}
        </p>
        <h1 class="report-date">{displayDate}</h1>
      </header>

      {Object.keys(siteSummaries).length > 0 && (
        <section>
          <h2 class="section-title">
            {t(lang, "report.site_summaries")}
          </h2>
          <div class="site-grid">
            {Object.entries(siteSummaries).map(([website, entry]) => (
              <article class="site-card" key={website}>
                <h3 class="site-name">{SITE_LABELS[website] || website}</h3>
                <ReportContent
                  className="site-body"
                  html={renderMarkdown(lang === "zh" ? entry.zh : entry.en)}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      <section class="report-section">
        <h2 class="section-title">
          {t(lang, "report.overall")}
        </h2>
        {(() => {
          const report = lang === "zh" ? summary.full_report_zh : summary.full_report_en;
          return report ? (
            <ReportContent className="report-body" html={renderMarkdown(report)} />
          ) : (
            <p class="report-empty">{t(lang, "report.empty")}</p>
          );
        })()}
      </section>
    </Layout>
  );
};

const ReportContent: FC<{ html: string; className?: string }> = ({ html, className }) => (
  <div class={className} dangerouslySetInnerHTML={{ __html: html }} />
);

export default Report;
