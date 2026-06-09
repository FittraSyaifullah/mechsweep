import { detectDocTypeFromUrl } from "@/lib/parser";
import { buildPrefetchedContent } from "@/lib/document-content";
import {
  buildExaSearchRequestBody,
  describeExaSearchProfile,
  resolveExaRequestTimeoutMs,
} from "@/lib/exa-config";
import { resolveExaBaseUrl } from "@/lib/env-sanitize";
import { parseJsonText } from "@/lib/json-safe";
import { requireExaApiKey } from "@/lib/search-provider";
import { resolveSweepMaxResults } from "@/lib/sweep-limits";
import { sanitizeSweepResult } from "@/lib/sweep-sanitize";
import type { SweepResult } from "@/types";

interface ExaSearchResult {
  title?: string;
  url?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
  text?: string;
}

export function mapExaResult(result: ExaSearchResult, index: number): SweepResult | null {
  if (!result.url) return null;

  return {
    title: result.title?.trim() || result.url,
    url: result.url,
    type: detectDocTypeFromUrl(result.url),
    description:
      result.highlights?.[0]?.trim() ??
      result.summary?.trim() ??
      result.text?.trim().slice(0, 220) ??
      "Mechanical engineering resource",
    relevanceScore: result.highlightScores?.[0] ?? Math.max(0.45, 1 - index * 0.02),
    category: "Other",
    prefetchedText: buildPrefetchedContent(
      result.text,
      result.highlights,
      result.summary
    ),
  };
}

export async function searchExa(
  query: string,
  excludeUrls: string[] = [],
  maxResults = resolveSweepMaxResults(),
  excludeDomains?: string[]
): Promise<SweepResult[]> {
  const apiKey = requireExaApiKey();
  const baseUrl = resolveExaBaseUrl();
  const numResults = resolveSweepMaxResults(maxResults);
  const profile = describeExaSearchProfile();
  const requestBody = buildExaSearchRequestBody({
    query,
    numResults,
    excludeUrls,
    excludeDomains,
  });
  const requestTimeoutMs = resolveExaRequestTimeoutMs(numResults, profile.searchType);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(
        `Exa search timed out after ${Math.round(requestTimeoutMs / 1000)}s. Use EXA_SEARCH_TYPE=fast and SWEEP_BATCH_SIZE=20 on Vercel Hobby.`
      );
    }
    throw error;
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Exa API error (${response.status}): ${errText.slice(0, 300)}`);
  }

  const raw = await response.text();
  let data: { results?: ExaSearchResult[] };
  try {
    data = parseJsonText<{ results?: ExaSearchResult[] }>(raw, "Exa API response");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Exa API returned invalid JSON: ${reason}`);
  }

  const excluded = new Set(excludeUrls);

  return (data.results ?? [])
    .map((result, index) => mapExaResult(result, index))
    .filter((result): result is SweepResult => result !== null && !excluded.has(result.url))
    .map(sanitizeSweepResult);
}

/** Lightweight live check that the Exa API key works. */
export async function verifyExaConnection(): Promise<{ ok: true; resultCount: number }> {
  const results = await searchExa("mechanical engineering PDF", [], 1);
  return { ok: true, resultCount: results.length };
}

export { buildExaSearchRequestBody, describeExaSearchProfile };
export { exaSearchEnabled } from "@/lib/search-provider";
