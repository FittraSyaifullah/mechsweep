const DEFAULT_EXA_BASE_URL = "https://api.exa.ai";

/** Strip PowerShell / shell artifacts accidentally stored in Vercel env vars. */
export function sanitizeEnvString(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/^-NoNewline\s*/i, "")
    .replace(/\uFEFF/g, "")
    .replace(/[\r\n]+/g, "")
    .trim();
}

export function resolveExaBaseUrl(): string {
  const raw = sanitizeEnvString(process.env.EXA_BASE_URL);
  if (!raw) return DEFAULT_EXA_BASE_URL;

  const withoutSearchPath = raw.replace(/\/search\/?$/i, "").replace(/\/+$/, "");

  try {
    const parsed = new URL(withoutSearchPath);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_EXA_BASE_URL;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_EXA_BASE_URL;
  }
}

export function sanitizeEnvNumber(
  value: string | undefined,
  fallback: number
): number {
  const raw = sanitizeEnvString(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
