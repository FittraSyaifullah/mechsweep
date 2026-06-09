/** Strip characters that break JSON serialization/parsing in API payloads. */
export function sanitizeForJson(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/\u2028|\u2029/g, " ");
}

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeForJson(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeJsonValue);
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const sanitized = sanitizeJsonValue(entry);
    if (sanitized !== undefined) out[key] = sanitized;
  }
  return out;
}

/** Serialize API payloads with sanitization and round-trip validation. */
export function serializeForJsonResponse(value: unknown): string {
  const json = JSON.stringify(sanitizeJsonValue(value));
  try {
    JSON.parse(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Response JSON serialization failed: ${detail}`);
  }
  return json;
}

export function parseJsonText<T>(raw: string, label = "Response"): T {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new SyntaxError(`${label} was empty`);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      const position = /position (\d+)/.exec(error.message)?.[1];
      const hint =
        position && Number(position) > 10_000
          ? " The payload may be too large — use excludeDomains instead of long URL lists."
          : " The payload may be truncated or contain invalid characters.";
      throw new SyntaxError(`${label} JSON parse failed: ${error.message}.${hint}`);
    }
    throw error;
  }
}

export async function readJsonBody<T>(
  request: Request,
  options: { maxBytes?: number; label?: string } = {}
): Promise<T> {
  const maxBytes = options.maxBytes ?? 256_000;
  const label = options.label ?? "Request body";
  const raw = await request.text();

  if (raw.length > maxBytes) {
    throw new Error(
      `${label} too large (${raw.length} bytes). Send excludeDomains plus a short excludeUrls list.`
    );
  }

  return parseJsonText<T>(raw, label);
}
