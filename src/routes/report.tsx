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
  googletrends: "Google Trends",
};

function getReportDate(summary: DailySummary | WeeklySummary, isWeekly?: boolean): string {
  if (isWeekly) return (summary as WeeklySummary).week_start_date;
  return (summary as DailySummary).summary_date;
}

const Report: FC<ReportProps> = ({ summary, lang, path, isWeekly }) => {
  const siteSummaries = parseSiteSummaries(summary.site_summaries);
  const displayDate = getReportDate(summary, isWeekly);

  const entries = Object.entries(siteSummaries);
  const supplyEntries = entries.filter(([site]) => site !== "googletrends");
  const demandEntry = siteSummaries["googletrends"];
  const hasSummaries = entries.length > 0;

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

      {hasSummaries && (
        <section class="summaries-container">
          <h2 class="section-title">
            {t(lang, "report.site_summaries")}
          </h2>

          {supplyEntries.length > 0 && (
            <div class="summary-zone supply-zone">
              <div class="zone-header">
                <span class="zone-title">{t(lang, "report.supply_section")}</span>
              </div>
              <div class="site-grid">
                {supplyEntries.map(([website, entry]) => (
                  <article class="site-card" key={website}>
                    <h3 class="site-name">{SITE_LABELS[website] || website}</h3>
                    <ReportContent
                      className="site-body"
                      html={renderMarkdown(lang === "zh" ? entry.zh : entry.en)}
                    />
                  </article>
                ))}
              </div>
            </div>
          )}

          {demandEntry && (
            <div class="summary-zone demand-zone">
              <div class="zone-header">
                <span class="zone-title">{t(lang, "report.demand_section")}</span>
                <span class="tag tag--demand">{t(lang, "report.demand_badge")}</span>
              </div>
              <article class="site-card demand-card">
                <h3 class="site-name">{SITE_LABELS.googletrends || "Google Trends"}</h3>
                <ReportContent
                  className="site-body demand-body"
                  html={renderMarkdown(lang === "zh" ? demandEntry.zh : demandEntry.en)}
                />
              </article>
            </div>
          )}
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
