import type { FC } from "hono/jsx";
import type { HomeTimelineItem } from "../db/client";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import Layout from "./layout";
import { stripMarkdownPreview } from "./markdown";

const ContentHtml: FC<{ html: string }> = ({ html }) => (
  <span dangerouslySetInnerHTML={{ __html: html }} />
);

interface HomeProps {
  items: HomeTimelineItem[];
  nextCursor: string | null;
  lang: Lang;
  path: string;
}

const Home: FC<HomeProps> = ({ items, nextCursor, lang, path }) => {
  return (
    <Layout title={t(lang, "site.subtitle")} lang={lang} path={path}>
      <div class="page-head">
        <p class="eyebrow">{t(lang, "home.eyebrow")}</p>
        <h2 class="page-title">{t(lang, "home.heading")}</h2>
      </div>

      {items.length === 0 ? (
        <div class="empty">{t(lang, "home.empty")}</div>
      ) : (
        <>
          <div id="items-container">
            {items.map((item) => {
              const href =
                item.type === "weekly"
                  ? `/reports/weekly/${item.display_date}?lang=${lang}`
                  : `/reports/${item.display_date}?lang=${lang}`;

              const badgeText =
                item.type === "weekly"
                  ? t(lang, "badge.weekly")
                  : t(lang, "badge.daily");

              const label =
                item.type === "weekly"
                  ? `${t(lang, "report.week_label", { date: item.display_date })}`
                  : item.display_date;

              const report = lang === "zh" ? item.full_report_zh : item.full_report_en;

              return (
                <a href={href} class="entry">
                  <div class="entry-top">
                    <span class="entry-date">{label}</span>
                    <span
                      class={`tag${item.type === "weekly" ? " tag--weekly" : ""}`}
                    >
                      {badgeText}
                    </span>
                  </div>
                  <p class="entry-preview">
                    {report
                      ? <ContentHtml html={stripMarkdownPreview(report)} />
                      : "..."}
                  </p>
                </a>
              );
            })}
          </div>

          {nextCursor && (
            <div class="load-more-wrap">
              <button
                id="load-more"
                class="btn-ghost"
                data-cursor={nextCursor}
                data-lang={lang}
              >
                {lang === "zh" ? "加载更多" : "Load more"}
              </button>
              <div id="load-more-msg" />
            </div>
          )}
        </>
      )}
    </Layout>
  );
};

export default Home;
