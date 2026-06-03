import { Hono } from "hono";
import { createDeepSeekModel } from "../aggregator/llm";
import { createInMemoryAgentTools } from "../aggregator/tools";
import { runAgentLoop } from "../aggregator/aggregate";
import { SYSTEM_PROMPT } from "../aggregator/aggregate";
import { MAX_STEPS } from "../aggregator/aggregate";

const app = new Hono();

app.post("/aggregate", async (c) => {
  const body = await c.req.json<{
    date: string;
    rawData: Record<string, unknown[]>;
  }>();

  const { date, rawData } = body;

  if (!date || !rawData) {
    return c.json({ success: false, error: "Missing date or rawData" }, 400);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, error: "DEEPSEEK_API_KEY not set" }, 500);
  }

  const model = createDeepSeekModel(apiKey);
  const { tools, getResults } = createInMemoryAgentTools(date, rawData);

  console.log(`[container] Starting agent loop for ${date}`);
  await runAgentLoop(model, tools, SYSTEM_PROMPT, MAX_STEPS);

  const { siteSummaries, reportEn, reportZh } = getResults();
  console.log(`[container] Done: ${Object.keys(siteSummaries).length} sites, report ${reportEn.length}c EN / ${reportZh.length}c ZH`);

  return c.json({
    success: true,
    siteSummaries,
    reportEn,
    reportZh,
  });
});

export default {
  port: 4000,
  fetch: app.fetch,
};
