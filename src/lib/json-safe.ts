/** Strip characters that break JSON serialization/parsing in API payloads. */
export function sanitizeForJson(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/\uFFFD/g, "");
}

export function parseJsonText<T>(raw: string, label = "Response"): T {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SyntaxError(`${label} was empty`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SyntaxError(
        `${label} JSON parse failed: ${error.message}. The payload may be truncated — retry with fewer excluded URLs.`
      );
    }
    throw error;
  }
}

export async function readJsonBody<T>(
  request: Request,
  options: { maxBytes?: number; label?: string } = {}
): Promise<T> {
  const maxBytes = options.maxBytes ?? 512_000;
  const label = options.label ?? "Request body";
  const raw = await request.text();

  if (raw.length > maxBytes) {
    throw new Error(`${label} too large (${raw.length} bytes). Reduce excluded URLs and retry.`);
  }

  return parseJsonText<T>(raw, label);
}
