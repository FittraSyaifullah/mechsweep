export const DEFAULT_FETCH_TIMEOUT_MS = 45000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {
    return "";
  }
}

export interface FetchRemoteOptions {
  timeoutMs?: number;
  rangeEnd?: number;
  retries?: number;
}

function buildHeaders(url: string, variant: number, rangeEnd?: number): HeadersInit {
  const origin = getOrigin(url);
  const base = {
    "Accept-Language": "en-US,en;q=0.9",
    Referer: origin,
    "Cache-Control": "no-cache",
  };

  if (variant === 0) {
    return {
      ...base,
      Accept:
        "application/pdf,text/csv,text/plain,text/html,application/xhtml+xml,application/octet-stream,*/*;q=0.8",
      "User-Agent": BROWSER_UA,
      ...(rangeEnd !== undefined ? { Range: `bytes=0-${rangeEnd}` } : {}),
    };
  }

  return {
    ...base,
    Accept: "*/*",
    "User-Agent": BROWSER_UA,
  };
}

export async function fetchRemoteUrl(
  url: string,
  options: FetchRemoteOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const retries = options.retries ?? 2;
  let useRange = options.rangeEnd;

  let lastResponse: Response | null = null;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const headerVariant = Math.min(attempt, 1);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: buildHeaders(url, headerVariant, useRange),
        signal: AbortSignal.timeout(timeoutMs),
      });

      lastResponse = response;

      if (response.ok || response.status === 206) {
        return response;
      }

      if (response.status === 416 && useRange !== undefined) {
        useRange = undefined;
        continue;
      }

      if ([403, 429, 502, 503, 504].includes(response.status) && attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("Fetch failed");
}

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF";
}

export function inferContentKind(
  contentType: string | null,
  url: string,
  buffer?: Buffer
): "pdf" | "csv" | "html" | "text" | "unknown" {
  const lower = contentType?.toLowerCase() ?? "";
  if (lower.includes("application/pdf") || (buffer && isPdfBuffer(buffer))) return "pdf";
  if (lower.includes("text/csv") || lower.includes("application/csv")) return "csv";
  if (lower.includes("text/html") || lower.includes("application/xhtml+xml")) return "html";
  if (lower.includes("text/plain")) return "text";
  if (lower.includes("application/octet-stream")) {
    if (buffer && isPdfBuffer(buffer)) return "pdf";
    if (/\.pdf(\?|#|$)/i.test(url)) return "pdf";
    if (/\.csv(\?|#|$)/i.test(url)) return "csv";
  }
  if (/\.pdf(\?|#|$)/i.test(url)) return "pdf";
  if (/\.csv(\?|#|$)/i.test(url)) return "csv";
  return "unknown";
}
