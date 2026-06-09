import { MAX_EXA_EXCLUDE_DOMAINS, SWEEP_MAX_EXCLUDE_URLS } from "@/lib/constants";
import { buildExaExcludeDomains } from "@/lib/exa-config";
import { sanitizeForJson } from "@/lib/json-safe";

export function sanitizeSweepUrl(url: string): string | null {
  try {
    const trimmed = sanitizeForJson(url.trim()).slice(0, 2048);
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/** Compact sweep POST body: recent URLs for exact dedup + domains for Exa (up to 1200). */
export function buildCompactSweepPayload(options: {
  query?: string;
  libraryUrls: string[];
  sweepUrls: string[];
  maxResults: number;
}): {
  query?: string;
  excludeUrls: string[];
  excludeDomains: string[];
  maxResults: number;
} {
  const library = options.libraryUrls
    .map(sanitizeSweepUrl)
    .filter((url): url is string => Boolean(url));
  const sweep = options.sweepUrls
    .map(sanitizeSweepUrl)
    .filter((url): url is string => Boolean(url));

  const excludeUrls: string[] = [];
  const seenUrls = new Set<string>();
  for (const url of [...sweep, ...library]) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    excludeUrls.push(url);
    if (excludeUrls.length >= SWEEP_MAX_EXCLUDE_URLS) break;
  }

  const excludeDomains = buildExaExcludeDomains([...sweep, ...library]).slice(
    0,
    MAX_EXA_EXCLUDE_DOMAINS
  );

  return {
    query: options.query?.trim() || undefined,
    excludeUrls,
    excludeDomains,
    maxResults: options.maxResults,
  };
}
