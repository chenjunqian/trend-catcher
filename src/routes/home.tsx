import type { FC } from "hono/jsx";
import type { DailySummary, WeeklySummary } from "../db/client";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import Layout from "./layout";
import { stripMarkdownPreview } from "./markdown";

const ContentHtml: FC<{ html: string }> = ({ html }) => (
  <span dangerouslySetInnerHTML={{ __html: html }} />
);

interface HomeItem {
  type: "daily" | "weekly";
  displayDate: string;
  report: string;
  created_at: number;
}

interface HomeProps {
  dailySummaries: Pick<
    DailySummary,
    "summary_date" | "full_report_en" | "full_report_zh" | "created_at"
  >[];
  weeklySummaries: Pick<
    WeeklySummary,
    "week_start_date" | "full_report_en" | "full_report_zh" | "created_at"
  >[];
  lang: Lang;
  path: string;
}

const Home: FC<HomeProps> = ({ dailySummaries, weeklySummaries, lang, path }) => {
  const items: HomeItem[] = [
    ...dailySummaries.map((s) => ({
      type: "daily" as const,
      displayDate: s.summary_date,
      report: lang === "zh" ? s.full_report_zh : s.full_report_en,
      created_at: s.created_at,
    })),
    ...weeklySummaries.map((s) => ({
      type: "weekly" as const,
      displayDate: s.week_start_date,
      report: lang === "zh" ? s.full_report_zh : s.full_report_en,
      created_at: s.created_at,
    })),
  ];

  items.sort((a, b) => b.created_at - a.created_at);

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
        items.map((item) => {
          const href =
            item.type === "weekly"
              ? `/reports/weekly/${item.displayDate}?lang=${lang}`
              : `/reports/${item.displayDate}?lang=${lang}`;

          const badgeText =
            item.type === "weekly"
              ? t(lang, "badge.weekly")
              : t(lang, "badge.daily");

          const label =
            item.type === "weekly"
              ? `${t(lang, "report.week_label", { date: item.displayDate })}`
              : item.displayDate;

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
                  {item.report
                    ? <ContentHtml html={stripMarkdownPreview(item.report)} />
                    : "..."}
                </p>
              </div>
            </a>
          );
        })
      )}
    </Layout>
  );
};

export default Home;
