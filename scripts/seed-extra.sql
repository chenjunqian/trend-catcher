INSERT INTO daily_summaries (summary_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at, updated_at)
VALUES
('2026-05-31', 'Daily report for May 31 in English.', '5月31日趋势报告中文版。', '{}', 0, CAST(strftime('%s','now') AS INTEGER)-86400, CAST(strftime('%s','now') AS INTEGER)-86400),
('2026-05-30', 'Daily report for May 30 in English.', '5月30日趋势报告中文版。', '{}', 0, CAST(strftime('%s','now') AS INTEGER)-172800, CAST(strftime('%s','now') AS INTEGER)-172800);
