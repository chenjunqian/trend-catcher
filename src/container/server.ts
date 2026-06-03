import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { createDeepSeekModel } from "../aggregator/llm";
import { createInMemoryAgentTools } from "../aggregator/tools";
import { runAgentLoop, SYSTEM_PROMPT, MAX_STEPS } from "../aggregator/aggregate";

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
  if (req.method !== "POST" || req.url !== "/aggregate") {
    json(res, 404, { success: false, error: "Not Found" });
    return;
  }

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
});

const PORT = parseInt(process.env.PORT || "4000", 10);
server.listen(PORT, () => {
  console.log(`[container] Listening on port ${PORT}`);
});
