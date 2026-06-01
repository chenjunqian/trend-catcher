// Generic HTTP fetcher with retry and timeout

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = 3,
  timeoutMs: number = 15000
): Promise<Response> {
  const label = new URL(url).hostname;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startMs = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html,application/json,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          ...options.headers,
        },
      });

      const elapsed = Date.now() - startMs;
      clearTimeout(timer);

      if (!response.ok && attempt < retries) {
        console.log(
          `[${label}] attempt ${attempt}/${retries} — HTTP ${response.status} (${elapsed}ms), retrying...`
        );
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.log(`[${label}] ✅ ${response.status} (${elapsed}ms)`);
      return response;
    } catch (err) {
      clearTimeout(timer);
      const elapsed = Date.now() - startMs;
      const reason =
        (err as Error).name === "AbortError"
          ? "timeout"
          : (err as Error).message ?? String(err);

      if (attempt < retries) {
        console.log(
          `[${label}] attempt ${attempt}/${retries} — ${reason} (${elapsed}ms), retrying...`
        );
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw new Error(
        `[${label}] Failed after ${retries} attempts: ${reason}`
      );
    }
  }

  throw new Error(`[${label}] Failed after ${retries} retries`);
}

export async function fetchJson<T>(
  url: string,
  retries: number = 3
): Promise<T> {
  const response = await fetchWithRetry(url, {}, retries);
  return response.json() as Promise<T>;
}

export async function fetchHtml(
  url: string,
  retries: number = 3
): Promise<string> {
  const response = await fetchWithRetry(url, {}, retries);
  return response.text();
}
