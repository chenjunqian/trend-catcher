import type { FC } from "hono/jsx";
import type { DailySummary, WeeklySummary } from "../db/client";
import type { Lang } from "../i18n";
import { t, switchLang } from "../i18n";
import type { SiteImage, SiteSummaryEntry } from "../aggregator/tools";
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

function parseSiteImages(entry: SiteSummaryEntry | undefined): SiteImage[] {
  if (!entry || !Array.isArray(entry.images)) return [];
  return entry.images.filter(
    (img): img is SiteImage =>
      !!img &&
      typeof img.name === "string" &&
      typeof img.url === "string" &&
      img.url.startsWith("http")
  );
}

function extractItemLinks(md: string): Array<{ name: string; url: string }> {
  const links: Array<{ name: string; url: string }> = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(md)) !== null) {
    links.push({ name: match[1].trim(), url: match[2].trim() });
  }
  return links;
}

function findItemUrl(entry: SiteSummaryEntry, name: string): string | undefined {
  const links = [...extractItemLinks(entry.en), ...extractItemLinks(entry.zh)];
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  const exact = links.find((link) => link.name.trim().toLowerCase() === target);
  if (exact) return exact.url;
  const partial = links.find((link) => {
    const candidate = link.name.trim().toLowerCase();
    return (
      candidate.length >= 3 &&
      target.length >= 3 &&
      (candidate.includes(target) || target.includes(candidate))
    );
  });
  return partial?.url;
}

const SiteGallery: FC<{ entry: SiteSummaryEntry }> = ({ entry }) => {
  const images = parseSiteImages(entry);
  if (images.length === 0) return null;

  return (
    <div class="site-gallery">
      {images.map((img) => {
        const itemUrl = findItemUrl(entry, img.name);
        return (
          <figure class="site-image" key={`${img.name}-${img.url}`}>
            <img
              src={img.url}
              alt={img.name}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <figcaption>
              {itemUrl ? <a href={itemUrl}>{img.name}</a> : img.name}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
};

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

      <div class="story-head">
        <h2 class="story-title">
          {displayDate}
          <span class="story-type">
            {t(lang, isWeekly ? "report.weekly_heading" : "report.heading")}
          </span>
        </h2>
      </div>

      {Object.keys(siteSummaries).length > 0 && (
        <section>
          <h3 class="section-title">
            {t(lang, "report.site_summaries")}
          </h3>
          <div class="columns">
            {Object.entries(siteSummaries).map(([website, entry]) => (
              <div class="column" key={website}>
                <div class="column-head">
                  <span class="column-name">{SITE_LABELS[website] || website}</span>
                  <span class="badge">{website}</span>
                </div>
                <ReportContent
                  className="column-body"
                  html={renderMarkdown(lang === "zh" ? entry.zh : entry.en)}
                />
                <SiteGallery entry={entry} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div class="report">
        {lang === "en" && (
          <div class="lang-section">
            <h2>
              {t(lang, "report.overall")}
            </h2>
            {summary.full_report_en ? (
              <ReportContent className="report-body" html={renderMarkdown(summary.full_report_en)} />
            ) : (
              <p class="report-empty">{t(lang, "report.empty")}</p>
            )}
          </div>
        )}

        {lang === "zh" && (
          <div class="lang-section">
            <h2>
              {t(lang, "report.overall")}
            </h2>
            {summary.full_report_zh ? (
              <ReportContent className="report-body" html={renderMarkdown(summary.full_report_zh)} />
            ) : (
              <p class="report-empty">{t(lang, "report.empty")}</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

const ReportContent: FC<{ html: string; className?: string }> = ({ html, className }) => (
  <div class={className} dangerouslySetInnerHTML={{ __html: html }} />
);

export default Report;
