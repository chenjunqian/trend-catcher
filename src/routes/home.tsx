import type { FC } from "hono/jsx";
import type { DailySummary } from "../db/client";
import type { Lang } from "../i18n";
import { t } from "../i18n";
import Layout from "./layout";

interface HomeProps {
  summaries: Pick<
    DailySummary,
    "summary_date" | "full_report_en" | "full_report_zh"
  >[];
  lang: Lang;
}

const Home: FC<HomeProps> = ({ summaries, lang }) => {
  return (
    <Layout title={t(lang, "site.subtitle")} lang={lang}>
      <h2 style={{ fontSize: "22px", marginBottom: "24px" }}>
        {t(lang, "home.heading")}
      </h2>

      {summaries.length === 0 ? (
        <div class="empty">
          <p style={{ fontSize: "16px" }}>{t(lang, "home.empty")}</p>
        </div>
      ) : (
        summaries.map((s) => {
          const report =
            lang === "zh" ? s.full_report_zh : s.full_report_en;
          return (
            <a
              href={`/reports/${s.summary_date}?lang=${lang}`}
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
                  <h3>{s.summary_date}</h3>
                  <span class="badge">{t(lang, "badge.daily")}</span>
                </div>
                <p>
                  {report
                    ? report.slice(0, 200) +
                      (report.length > 200 ? "..." : "")
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
