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

  if (variant === 1) {
    return {
      ...base,
      Accept: "*/*",
      "User-Agent": BROWSER_UA,
    };
  }

  return {
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "application/pdf,text/html,text/plain,*/*",
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
    const headerVariant = Math.min(attempt, 2);
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

      if ([401, 403, 429, 502, 503, 504].includes(response.status) && attempt < retries) {
        useRange = undefined;
        await sleep(400 * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        useRange = undefined;
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

function sniffHtml(buffer: Buffer): boolean {
  const start = buffer.subarray(0, 512).toString("utf8").trim().toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html") || start.startsWith("<head");
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
  if (buffer && sniffHtml(buffer)) return "html";
  if (lower.includes("application/octet-stream")) {
    if (buffer && isPdfBuffer(buffer)) return "pdf";
    if (/\.pdf(\?|#|$)/i.test(url)) return "pdf";
    if (/\.csv(\?|#|$)/i.test(url)) return "csv";
  }
  if (/\.pdf(\?|#|$)/i.test(url)) return "pdf";
  if (/\.csv(\?|#|$)/i.test(url)) return "csv";
  if (/\.txt(\?|#|$)/i.test(url)) return "text";
  return "unknown";
}

export function decodeBufferText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;
  return buffer.toString("latin1");
}

export interface FetchedDocumentBuffer {
  buffer: Buffer;
  contentType: string | null;
  finalUrl: string;
}

export async function fetchDocumentBuffer(
  url: string,
  options: FetchRemoteOptions = {}
): Promise<FetchedDocumentBuffer> {
  const fetchOptions = { ...options, rangeEnd: undefined, retries: options.retries ?? 3 };
  let response = await fetchRemoteUrl(url, fetchOptions);

  if (!response.ok && response.status !== 206) {
    throw new Error(`Fetch failed (${response.status})`);
  }

  let buffer = Buffer.from(await response.arrayBuffer());

  if (response.status === 206 || (buffer.length < 16384 && (isPdfBuffer(buffer) || sniffHtml(buffer)))) {
    try {
      const fullResponse = await fetchRemoteUrl(url, { ...fetchOptions, retries: 1 });
      if (fullResponse.ok) {
        const fullBuffer = Buffer.from(await fullResponse.arrayBuffer());
        if (fullBuffer.length > buffer.length) {
          response = fullResponse;
          buffer = fullBuffer;
        }
      }
    } catch {
      // Keep the best response we already have.
    }
  }

  return {
    buffer,
    contentType: response.headers.get("content-type"),
    finalUrl: response.url || url,
  };
}
