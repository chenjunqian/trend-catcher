// Generic HTTP fetcher with retry and timeout

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = 3,
  timeoutMs: number = 15000
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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

      if (!response.ok && attempt < retries) {
        // Exponential backoff before retry
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
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
