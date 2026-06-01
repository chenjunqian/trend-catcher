INSERT INTO daily_summaries (summary_date, full_report_en, full_report_zh, site_summaries, is_notified, created_at, updated_at)
VALUES (
  '2026-06-01',
  '## Daily Trend Report

### Product Hunt
**folk** — The AI in your texts that gets stuff done. A new class of AI assistant that lives in your messages, not in a separate app.

**Tokenwise** — A smart LLM proxy that shows where you are overpaying on API calls.

**Skylive** — Never miss a celestial event. A niche but well-executed app.

### Hacker News
Red Hat compromised NPM packages topped the list. Running Gemma 4 on a 10-year-old Xeon sparked local AI discussion. Cloudflare Turnstile requiring WebGL fingerprinting raised privacy concerns.

### GitHub Trending
AI repos dominate: MoneyPrinterTurbo (video generation), TradingAgents (trading), VoxCPM (TTS). AI tools are being democratized for non-technical users.

### Key Takeaways
- AI moving from chat to embedded assistants in messaging, meetings, coding
- Cost optimization for AI infrastructure is a growing product category
- Supply chain security and privacy concerns grow with AI adoption
- AI video/audio tools create new indie dev opportunities',
  '## 每日趋势报告

### Product Hunt
**folk** — 嵌入短信的 AI 助手，无需独立 App。对话式 AI 正在深入消息场景。
**Tokenwise** — 智能 LLM 代理，帮助开发者发现 API 调用的浪费。
**Skylive** — 天文事件追踪工具，展示了超细分领域的 App 机会。

### Hacker News
Red Hat NPM 包被入侵事件登顶。在 10 年老 Xeon 上跑 Gemma 4 引发本地 AI 推理讨论。Cloudflare Turnstile WebGL 指纹引发隐私争论。

### GitHub Trending
AI 项目霸榜：MoneyPrinterTurbo（AI 短视频）、TradingAgents（多智能体交易）、VoxCPM（语音合成）。AI 工具面向非技术用户的民主化趋势明显。

### 关键方向
- AI 从聊天界面转向嵌入式助手
- AI 基础设施成本优化成为独立品类
- 供应链安全与隐私随 AI 普及日益重要
- AI 音视频生成工具为独立开发者创造新机会',
  '{"producthunt":{"en":"Top products: folk (AI messaging assistant), Tokenwise (LLM cost optimizer), Skylive (celestial tracker). Key trend: AI assistants embedding into existing workflows.","zh":"Top 产品：folk（AI 消息助手）、Tokenwise（LLM 成本优化）、Skylive（天文追踪）。关键趋势：AI 助手嵌入现有工作流。"},"hackernews":{"en":"Top stories: compromised Red Hat NPM packages, running Gemma 4 on old Xeon, Turnstile WebGL debate. Key trend: supply chain security and local AI inference.","zh":"Top 话题：Red Hat NPM 包被入侵、旧 Xeon 跑 Gemma 4、Turnstile WebGL 隐私争议。关键趋势：供应链安全和本地 AI 推理。"},"github":{"en":"Trending repos: MoneyPrinterTurbo (AI video), TradingAgents (trading), VoxCPM (TTS). Key trend: AI creation tools for non-developers.","zh":"Trending 项目：MoneyPrinterTurbo（AI 视频）、TradingAgents（多智能体交易）、VoxCPM（语音合成）。关键趋势：面向非开发者的 AI 创作工具。"}}',
  0,
  CAST(strftime('%s','now') AS INTEGER),
  CAST(strftime('%s','now') AS INTEGER)
);
