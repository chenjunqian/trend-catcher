export const KAMI_TOKENS = `
@font-face {
  font-family: "TsangerJinKai02";
  src: url("/fonts/TsangerJinKai02-W04.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "TsangerJinKai02";
  src: url("/fonts/TsangerJinKai02-W05.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
:root {
  --parchment: #f5f4ed;
  --ivory: #faf9f5;
  --inline-code-bg: #f0eee6;
  --warm-sand: #e8e6dc;
  --brand: #1B365D;
  --brand-light: #2D5A8A;
  --brand-tint: #EEF2F7;
  --tag-bg: #E4ECF5;
  --near-black: #141413;
  --dark-warm: #3d3d3a;
  --olive: #504e49;
  --stone: #6b6a64;
  --border: #e8e6dc;
  --border-soft: #e5e3d8;
  --line: #d8d5c8;
  --error: #8C4B3F;
  --serif: Charter, Georgia, Palatino, "Times New Roman", serif;
  --sans: var(--serif);
  --latin-ui: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mono: "JetBrains Mono", "SF Mono", "Fira Code", Consolas, Monaco, monospace;
}
html[lang="zh-CN"] {
  --serif: Charter, Georgia, "TsangerJinKai02", "Source Han Serif SC",
    "Noto Serif CJK SC", "Songti SC", "STSong", serif;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { overscroll-behavior: contain; }
body {
  font-family: var(--serif);
  font-synthesis: none;
  background: var(--parchment);
  color: var(--near-black);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
a { color: var(--brand); text-decoration: none; transition: color 0.15s; }
a:hover { color: var(--brand-light); }
p { text-wrap: pretty; }
strong { font-weight: 500; }
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--brand);
  color: var(--ivory);
  font-family: var(--serif);
  font-weight: 500;
  font-size: 15px;
  letter-spacing: 0.2px;
  padding: 11px 24px;
  border-radius: 999px;
  border: 1.5px solid var(--brand);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-primary:hover {
  background: var(--brand-light);
  border-color: var(--brand-light);
  color: var(--ivory);
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: var(--brand);
  font-family: var(--serif);
  font-weight: 500;
  font-size: 15px;
  letter-spacing: 0.2px;
  padding: 11px 24px;
  border-radius: 999px;
  border: 1.5px solid var(--brand);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-ghost:hover { background: var(--brand-tint); color: var(--brand); }
.tag {
  display: inline-block;
  background: var(--warm-sand);
  color: var(--dark-warm);
  font-family: var(--latin-ui);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 3px;
  white-space: nowrap;
}
.tag--weekly { background: var(--tag-bg); color: var(--brand); }
.eyebrow {
  font-family: var(--latin-ui);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--stone);
}
`;

export const LAYOUT_STYLES = `
.site-header { border-bottom: 1px solid var(--border-soft); background: var(--parchment); }
.site-header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px 32px 22px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.brand { display: flex; flex-direction: column; gap: 3px; }
.brand-title { font-family: var(--serif); font-size: 28px; font-weight: 500; line-height: 1.15; }
.brand-title a { color: var(--near-black); }
.brand-title a:hover { color: var(--brand); }
.brand-tagline {
  font-family: var(--latin-ui);
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--stone);
}
.header-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.lang-switch {
  font-family: var(--latin-ui);
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--brand);
  white-space: nowrap;
}
.lang-switch:hover { color: var(--brand-light); }
.nl-form {
  display: flex;
  align-items: stretch;
  background: var(--ivory);
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
}
.nl-input {
  border: 0;
  outline: none;
  background: transparent;
  font-family: var(--latin-ui);
  font-size: 13px;
  padding: 9px 14px;
  width: 180px;
  min-width: 0;
  color: var(--near-black);
}
.nl-input::placeholder { color: var(--stone); }
.nl-btn {
  border: 0;
  background: var(--brand);
  color: var(--ivory);
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 500;
  padding: 9px 16px;
  cursor: pointer;
  white-space: nowrap;
}
.nl-btn:hover { background: var(--brand-light); }
#nl-msg { font-family: var(--latin-ui); font-size: 12px; color: var(--stone); }

main { max-width: 1120px; margin: 0 auto; padding: 48px 32px 72px; }
.page-head { margin-bottom: 36px; }
.page-head .eyebrow { margin-bottom: 8px; }
.page-title { font-family: var(--serif); font-size: 34px; font-weight: 500; line-height: 1.2; }

.entry {
  display: block;
  padding: 22px 0;
  border-bottom: 1px solid var(--border-soft);
  transition: background 0.15s;
}
.entry:hover { background: var(--ivory); text-decoration: none; }
.entry-top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.entry-date { font-family: var(--serif); font-size: 21px; font-weight: 500; color: var(--near-black); }
.entry:hover .entry-date { color: var(--brand); }
.entry-preview {
  margin-top: 8px;
  font-family: var(--serif);
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--olive);
  max-width: 760px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}
.empty { padding: 72px 0; text-align: center; font-family: var(--serif); font-size: 16px; color: var(--olive); }
.load-more-wrap { text-align: center; padding: 36px 0 8px; }
#load-more-msg { font-family: var(--latin-ui); font-size: 12px; color: var(--stone); margin-top: 10px; min-height: 1.2em; }

.back-link {
  display: inline-block;
  margin-bottom: 24px;
  font-family: var(--latin-ui);
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--stone);
}
.back-link:hover { color: var(--brand); }
.report-head { padding-bottom: 20px; border-bottom: 1px solid var(--border-soft); margin-bottom: 36px; }
.report-head .eyebrow { color: var(--brand); margin-bottom: 8px; }
.report-date { font-family: var(--serif); font-size: 38px; font-weight: 500; line-height: 1.15; }

.section-title {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.25;
  margin-bottom: 20px;
}
.site-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.site-card { background: var(--ivory); border-radius: 8px; padding: 20px 22px; }
.site-name { font-family: var(--serif); font-size: 18px; font-weight: 500; margin-bottom: 10px; }
.site-body { font-family: var(--serif); font-size: 14px; line-height: 1.55; color: var(--dark-warm); }
.site-body p { margin: 0 0 10px; }
.site-body h1, .site-body h2, .site-body h3 {
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 500;
  margin: 12px 0 6px;
}
.site-body ul, .site-body ol { margin: 0 0 10px; padding-left: 18px; }
.site-body li { margin-bottom: 4px; text-wrap: balance; }
.site-body a { color: var(--brand); text-decoration: underline; text-underline-offset: 2px; }

.report-section { margin-top: 48px; }
.report-body {
  font-family: var(--serif);
  font-size: 16px;
  line-height: 1.55;
  max-width: 760px;
}
.report-body p { margin: 0 0 16px; text-wrap: balance; }
.report-body h1, .report-body h2 {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 500;
  line-height: 1.25;
  margin: 32px 0 12px;
}
.report-body h3 { font-family: var(--serif); font-size: 18px; font-weight: 500; margin: 22px 0 8px; }
.report-body ul, .report-body ol { margin: 0 0 16px; padding-left: 24px; }
.report-body li { margin-bottom: 6px; text-wrap: balance; }
.report-body a { color: var(--brand); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.report-body blockquote { margin: 0 0 16px; padding: 2px 0 2px 20px; color: var(--olive); }
.report-body code {
  font-family: var(--mono);
  font-size: 13px;
  background: var(--inline-code-bg);
  padding: 1px 5px;
  border-radius: 2px;
}
.report-empty { font-family: var(--serif); color: var(--olive); }

.site-footer { border-top: 1px solid var(--border-soft); margin-top: 72px; }
.site-footer-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
}
.footer-brand { display: flex; flex-direction: column; gap: 3px; }
.footer-name { font-family: var(--serif); font-size: 20px; font-weight: 500; }
.footer-line { font-family: var(--latin-ui); font-size: 12px; color: var(--olive); }
.footer-colophon {
  text-align: right;
  font-family: var(--latin-ui);
  font-size: 12px;
  line-height: 1.6;
  color: var(--stone);
}
.footer-colophon a { color: var(--dark-warm); }
.footer-colophon a:hover { color: var(--brand); }
.footer-colophon p { text-wrap: balance; }

.pull-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 0;
  overflow: hidden;
  background: var(--parchment);
  transition: height 0.15s ease-out;
}
.pull-indicator .spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-soft);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: ptr-spin 0.6s linear infinite;
  margin-bottom: 10px;
}
@keyframes ptr-spin { to { transform: rotate(360deg); } }

@media (max-width: 880px) {
  .site-header-inner { padding: 22px 20px 18px; align-items: flex-start; }
  .header-actions { flex: 1 1 100%; }
  .nl-form { flex: 1 1 200px; }
  .nl-input { width: 100%; }
  main { padding: 32px 20px 56px; }
  .page-title { font-size: 28px; }
  .report-date { font-size: 30px; }
  .site-grid { grid-template-columns: 1fr; }
  .site-footer-inner { flex-direction: column; align-items: flex-start; gap: 18px; padding: 28px 20px; }
  .footer-colophon { text-align: left; }
}

@media (max-width: 480px) {
  .brand-title { font-size: 24px; }
  .header-actions { gap: 10px; }
  .nl-form { flex: 1 1 100%; }
  .entry-top { flex-direction: column; align-items: flex-start; gap: 8px; }
  .entry-date { font-size: 19px; }
}
`;

export const STANDALONE_STYLES = `
.standalone { max-width: 560px; margin: 0 auto; padding: 96px 24px 80px; }
.panel { background: var(--ivory); border-radius: 8px; padding: 40px 36px; text-align: center; }
.panel h1 { font-family: var(--serif); font-size: 26px; font-weight: 500; margin-bottom: 14px; }
.panel p { font-family: var(--serif); font-size: 15px; line-height: 1.55; color: var(--olive); margin-bottom: 26px; }
.panel-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.panel .btn-primary, .panel .btn-ghost { font-size: 14px; padding: 11px 22px; }
@media (max-width: 480px) {
  .standalone { padding: 48px 16px 56px; }
  .panel { padding: 32px 22px; }
}
`;
