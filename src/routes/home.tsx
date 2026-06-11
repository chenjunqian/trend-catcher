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
      <h2 style={{ fontSize: "22px", marginBottom: "24px" }}>
        {t(lang, "home.heading")}
      </h2>

      {items.length === 0 ? (
        <div class="empty">
          <p style={{ fontSize: "16px" }}>{t(lang, "home.empty")}</p>
        </div>
      ) : (
        <>
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
              <a
                href={href}
                style="text-decoration: none; color: inherit;"
              >
                <div class="card">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <h3>{label}</h3>
                    <span class="badge">{badgeText}</span>
                  </div>
                  <p>
                    {report
                      ? <ContentHtml html={stripMarkdownPreview(report)} />
                      : "..."}
                  </p>
                </div>
              </a>
            );
          })}

          {nextCursor && (
            <div style={{ textAlign: "center", padding: "16px 0 32px" }}>
              <a
                href={`/?cursor=${nextCursor}&lang=${lang}`}
                style={{
                  display: "inline-block",
                  padding: "8px 20px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                {lang === "zh" ? "加载更多" : "Load more"}
              </a>
            </div>
          )}
        </>
      )}
    </Layout>
  );
};

export default Home;
