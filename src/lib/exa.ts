import { detectDocTypeFromUrl } from "@/lib/parser";
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
    prefetchedText: result.text?.trim() || undefined,
  };
}

export async function searchExa(query: string, excludeUrls: string[] = []): Promise<SweepResult[]> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const baseUrl = (process.env.EXA_BASE_URL ?? "https://api.exa.ai").trim();
  const searchType = process.env.EXA_SEARCH_TYPE?.trim() || "fast";
  const numResults = Math.min(
    Math.max(Number(process.env.EXA_NUM_RESULTS ?? 32), 1),
    100
  );

  const excludedDomains = Array.from(
    new Set(
      excludeUrls
        .map(hostnameFromUrl)
        .filter((host): host is string => Boolean(host))
    )
  ).slice(0, 120);

  const response = await fetch(`${baseUrl}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      query: `mechanical engineering documents PDF datasheets textbooks standards: ${query}`,
      type: searchType,
      numResults,
      ...(excludedDomains.length > 0 ? { excludeDomains: excludedDomains } : {}),
      contents: {
        highlights: true,
        text: { maxCharacters: 12000 },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Exa API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { results?: ExaSearchResult[] };
  const excluded = new Set(excludeUrls);

  return (data.results ?? [])
    .map((result, index) => mapExaResult(result, index))
    .filter((result): result is SweepResult => result !== null && !excluded.has(result.url));
}

export function exaSearchEnabled(): boolean {
  const provider = process.env.SEARCH_PROVIDER?.trim().toLowerCase() ?? "exa";
  return provider === "exa" && Boolean(process.env.EXA_API_KEY?.trim());
}
