import { detectDocTypeFromUrl } from "@/lib/parser";
import { buildPrefetchedContent } from "@/lib/document-content";
import {
  exaIncludesFullText,
  resolveExaExcludeDomainLimit,
  resolveExaRequestTimeoutMs,
  resolveExaTextMaxCharacters,
  resolveSweepMaxResults,
} from "@/lib/sweep-limits";
import type { SweepResult } from "@/types";

interface ExaSearchResult {
  title?: string;
  url?: string;
  highlights?: string[];
  highlightScores?: number[];
  summary?: string;
  text?: string;
}

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
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
  maxResults = resolveSweepMaxResults()
): Promise<SweepResult[]> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const baseUrl = (process.env.EXA_BASE_URL ?? "https://api.exa.ai").trim();
  const searchType = process.env.EXA_SEARCH_TYPE?.trim() || "fast";
  const numResults = resolveSweepMaxResults(maxResults);
  const includeFullText = exaIncludesFullText(numResults);
  const requestTimeoutMs = resolveExaRequestTimeoutMs(numResults);

  const excludedDomains = Array.from(
    new Set(
      excludeUrls
        .map(hostnameFromUrl)
        .filter((host): host is string => Boolean(host))
    )
  ).slice(0, resolveExaExcludeDomainLimit());

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
      body: JSON.stringify({
        query: `mechanical engineering documents PDF datasheets CAD STL STEP DWG JSON CSV markdown zip textbooks standards: ${query}`,
        type: searchType,
        numResults,
        ...(excludedDomains.length > 0 ? { excludeDomains: excludedDomains } : {}),
        contents: includeFullText
          ? {
              highlights: true,
              text: { maxCharacters: resolveExaTextMaxCharacters(numResults) },
            }
          : {
              highlights: { maxCharacters: resolveExaTextMaxCharacters(numResults) },
            },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(
        `Exa search timed out after ${Math.round(requestTimeoutMs / 1000)}s. Retry or use a narrower query.`
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
    data = JSON.parse(raw) as { results?: ExaSearchResult[] };
  } catch {
    throw new Error(`Exa API returned invalid JSON: ${raw.slice(0, 200)}`);
  }
  const excluded = new Set(excludeUrls);

  return (data.results ?? [])
    .map((result, index) => mapExaResult(result, index))
    .filter((result): result is SweepResult => result !== null && !excluded.has(result.url));
}

export function exaSearchEnabled(): boolean {
  const provider = process.env.SEARCH_PROVIDER?.trim().toLowerCase() ?? "exa";
  return provider === "exa" && Boolean(process.env.EXA_API_KEY?.trim());
}
