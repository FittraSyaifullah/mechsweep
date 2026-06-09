import { NextRequest, NextResponse } from "next/server";
import { callChatAI } from "@/lib/ai";
import { exaSearchEnabled, searchExa, describeExaSearchProfile } from "@/lib/exa";
import { resolveEffectiveExaBatchSize } from "@/lib/exa-config";
import { fetchRemoteUrl } from "@/lib/fetch-document";
import { SWEEP_PREFETCH_MAX_CHARS } from "@/lib/constants";
import { resolveSweepRequestLimit } from "@/lib/sweep-limits";
import {
  detectDocTypeFromContentType,
  detectDocTypeFromUrl,
  normalizeDocType,
  parseJsonFromResponse,
} from "@/lib/parser";
import { SWEEP_TYPE_HINT } from "@/lib/file-types";
import type { DocType, SweepResult } from "@/types";

const VALIDATE_TIMEOUT_MS = 12000;
const VALIDATE_CONCURRENCY = 20;
export const maxDuration = 60;
const MAX_FETCH_BYTES = 15 * 1024 * 1024;
const DEFAULT_MISTRAL_SEARCH_MODEL = "mistral-small-latest";
const DEFAULT_OPENROUTER_SEARCH_MODEL = "perplexity/sonar-pro";

function buildSweepSystemPrompt(resultTarget: number): string {
  return `You are a mechanical engineering research agent. Find ${Math.min(resultTarget, 60)} real, publicly accessible mechanical engineering documents relevant to the user's query.

Return ONLY valid JSON with this shape:
{"results":[{"title":"...","url":"https://...","type":"${SWEEP_TYPE_HINT}","description":"1 sentence","relevanceScore":0.0,"category":"..."}]}

Each result needs title, real https url, type (${SWEEP_TYPE_HINT}), description, relevanceScore (0-1), and category from: Thermodynamics, Fluid Mechanics, Solid Mechanics, Materials Science, Manufacturing, Dynamics & Vibrations, Heat Transfer, Machine Design, FEA / FEM, Control Systems, Robotics, HVAC, Other.

Prefer PDFs, datasheets, CAD (STL/STEP/DWG), standards, JSON/CSV datasets, markdown notes, and open textbooks. Include zip archives when they contain engineering documents.`;
}

function normalizeUrl(input: string): string | null {
  try {
    const trimmed = input.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function normalizeDocTypeValue(type: string, url: string): DocType {
  return normalizeDocType(type, url);
}

function getValidatedSize(response: Response): number | null {
  const contentRange = response.headers.get("content-range");
  const rangeMatch = contentRange?.match(/\/(\d+)$/);
  if (rangeMatch) return Number(rangeMatch[1]);

  const contentLength = response.headers.get("content-length");
  if (!contentLength) return null;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) ? parsed : null;
}

async function validateSweepResult(result: SweepResult): Promise<SweepResult | null> {
  const url = normalizeUrl(result.url);
  if (!url) return null;

  try {
    const response = await fetchRemoteUrl(url, {
      timeoutMs: VALIDATE_TIMEOUT_MS,
      rangeEnd: 4095,
      retries: 1,
    });

    if (!response.ok && response.status !== 206) return null;

    const responseSize = getValidatedSize(response);
    if (responseSize && responseSize > MAX_FETCH_BYTES) return null;

    const finalUrl = response.url || url;
    const fallbackType = normalizeDocTypeValue(result.type, finalUrl);
    const type = detectDocTypeFromContentType(
      response.headers.get("content-type"),
      fallbackType
    );

    return {
      ...result,
      url: finalUrl,
      type,
    };
  } catch {
    return null;
  }
}

async function validateSweepResults(
  candidates: SweepResult[],
  maxResults: number
): Promise<SweepResult[]> {
  const validated: SweepResult[] = [];

  for (let i = 0; i < candidates.length; i += VALIDATE_CONCURRENCY) {
    const batch = candidates.slice(i, i + VALIDATE_CONCURRENCY);
    const settled = await Promise.all(batch.map(validateSweepResult));
    for (const result of settled) {
      if (result) validated.push(result);
    }
    if (validated.length >= maxResults) break;
  }

  return validated
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

async function finalizeSweepResults(
  candidates: SweepResult[],
  options: { skipValidation?: boolean } = {},
  maxResults = resolveSweepRequestLimit()
): Promise<SweepResult[]> {
  const ranked = candidates.slice().sort((a, b) => b.relevanceScore - a.relevanceScore);

  if (options.skipValidation) {
    return ranked.slice(0, maxResults);
  }

  return validateSweepResults(ranked, maxResults);
}

async function searchWithMistral(
  query: string,
  excluded: string[],
  maxResults: number
): Promise<SweepResult[]> {
  const userPrompt =
    excluded.length > 0
      ? `${query}\n\nAvoid these URLs because they are already in the user's current sweep/library:\n${excluded.join("\n")}`
      : query;

  const { text: rawText } = await callChatAI({
    mistralModel: process.env.MISTRAL_SEARCH_MODEL?.trim() ?? DEFAULT_MISTRAL_SEARCH_MODEL,
    openRouterModel:
      process.env.OPENROUTER_SEARCH_MODEL?.trim() ?? DEFAULT_OPENROUTER_SEARCH_MODEL,
    messages: [
      { role: "system", content: buildSweepSystemPrompt(maxResults) },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 4000,
    temperature: 0.2,
    timeoutMs: 20_000,
    responseFormat: { type: "json_object" },
  });

  const parsedBody = parseJsonFromResponse<{ results?: SweepResult[] } | SweepResult[]>(rawText);
  const parsed = Array.isArray(parsedBody) ? parsedBody : (parsedBody.results ?? []);

  return parsed
    .filter(
      (r) =>
        r.title &&
        r.url &&
        /^https?:\/\//i.test(r.url) &&
        r.type &&
        typeof r.relevanceScore === "number"
    )
    .map((r) => {
      const url = normalizeUrl(r.url);
      if (!url) return null;
      if (excluded.includes(url)) return null;
      return {
        ...r,
        url,
        type: normalizeDocTypeValue(r.type, url),
      };
    })
    .filter((r): r is SweepResult => r !== null)
    .slice(0, maxResults);
}

function compactSweepResults(results: SweepResult[]): SweepResult[] {
  return results.map((result) => {
    if (!result.prefetchedText || result.prefetchedText.length <= SWEEP_PREFETCH_MAX_CHARS) {
      return result;
    }
    return {
      ...result,
      prefetchedText: result.prefetchedText.slice(0, SWEEP_PREFETCH_MAX_CHARS),
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const data = (await request.json()) as {
      query?: string;
      excludeUrls?: string[];
      maxResults?: number;
    };
    const query = data.query?.trim() || "Find mechanical engineering documents";
    const excluded = (data.excludeUrls ?? []).slice(0, 1200);
    const maxResults =
      data.maxResults !== undefined
        ? resolveSweepRequestLimit(data.maxResults)
        : resolveEffectiveExaBatchSize();
    const exaProfile = describeExaSearchProfile();

    if (exaSearchEnabled()) {
      try {
        const exaCandidates = await searchExa(query, excluded, maxResults);
        const results = compactSweepResults(
          await finalizeSweepResults(exaCandidates, { skipValidation: true }, maxResults)
        );
        return NextResponse.json({
          results,
          provider: "exa",
          maxResults,
          exa: exaProfile,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Exa search failed";
        console.warn(`Exa search failed, falling back to Mistral: ${reason}`);
      }
    }

    const mistralCandidates = await searchWithMistral(query, excluded, maxResults);
    const results = compactSweepResults(
      await finalizeSweepResults(mistralCandidates, {}, maxResults)
    );
    return NextResponse.json({ results, provider: "mistral", maxResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sweep failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
