import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { createDeepSeekModel } from "../aggregator/llm";
import { createInMemoryAgentTools } from "../aggregator/tools";
import { createInMemoryWeeklyAgentTools } from "../aggregator/weekly-tools";
import { runAgentLoop, SYSTEM_PROMPT, MAX_STEPS } from "../aggregator/aggregate";
import { runWeeklyAgentLoop, WEEKLY_SYSTEM_PROMPT, WEEKLY_MAX_STEPS } from "../aggregator/weekly-aggregate";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || !(req.url === "/aggregate" || req.url === "/aggregate-weekly")) {
    json(res, 404, { success: false, error: "Not Found" });
    return;
  }

  if (req.url === "/aggregate-weekly") {
    await handleWeeklyAggregation(req, res);
    return;
  }

  await handleDailyAggregation(req, res);
});

async function handleDailyAggregation(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readBody(req);
    const { date, rawData, apiKey } = JSON.parse(body) as {
      date: string;
      rawData: Record<string, unknown[]>;
      apiKey: string;
    };

    if (!date || !rawData || !apiKey) {
      json(res, 400, { success: false, error: "Missing date, rawData, or apiKey" });
      return;
    }

    const model = createDeepSeekModel(apiKey);
    const { tools, getResults } = createInMemoryAgentTools(date, rawData);

    console.log(`[container] Starting agent loop for ${date}`);
    await runAgentLoop(model, tools, SYSTEM_PROMPT, MAX_STEPS);

    const { siteSummaries, reportEn, reportZh } = getResults();
    console.log(`[container] Done: ${Object.keys(siteSummaries).length} sites, report ${reportEn.length}c EN / ${reportZh.length}c ZH`);

    json(res, 200, {
      success: true,
      siteSummaries,
      reportEn,
      reportZh,
    });
  } catch (err) {
    console.error("[container] Error:", (err as Error).message);
    json(res, 500, { success: false, error: (err as Error).message });
  }
}

async function handleWeeklyAggregation(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readBody(req);
    const { weekStartDate, dailySummaries, apiKey } = JSON.parse(body) as {
      weekStartDate: string;
      dailySummaries: Array<{
        summary_date: string;
        full_report_en: string;
        full_report_zh: string;
        site_summaries: string;
      }>;
      apiKey: string;
    };

    if (!weekStartDate || !dailySummaries || !apiKey) {
      json(res, 400, { success: false, error: "Missing weekStartDate, dailySummaries, or apiKey" });
      return;
    }

    const model = createDeepSeekModel(apiKey);
    const { tools, getResults } = createInMemoryWeeklyAgentTools(weekStartDate, dailySummaries);

    console.log(`[container] Starting weekly agent loop for ${weekStartDate}`);
    await runWeeklyAgentLoop(model, tools, WEEKLY_SYSTEM_PROMPT, WEEKLY_MAX_STEPS);

    const { siteSummaries, reportEn, reportZh } = getResults();
    console.log(`[container] Weekly done: ${Object.keys(siteSummaries).length} sites, report ${reportEn.length}c EN / ${reportZh.length}c ZH`);

    json(res, 200, {
      success: true,
      siteSummaries,
      reportEn,
      reportZh,
    });
  } catch (err) {
    console.error("[container] Weekly error:", (err as Error).message);
    json(res, 500, { success: false, error: (err as Error).message });
  }
}

const PORT = parseInt(process.env.PORT || "4000", 10);
server.listen(PORT, () => {
  console.log(`[container] Listening on port ${PORT}`);
});
