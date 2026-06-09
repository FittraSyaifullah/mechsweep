import { NextRequest, NextResponse } from "next/server";
import { callChatAI } from "@/lib/ai";
import { exaSearchEnabled, searchExa } from "@/lib/exa";
import { fetchRemoteUrl } from "@/lib/fetch-document";
import {
  detectDocTypeFromContentType,
  detectDocTypeFromUrl,
  parseJsonFromResponse,
} from "@/lib/parser";
import type { DocType, SweepResult } from "@/types";

const VALIDATE_TIMEOUT_MS = 12000;
const MAX_RESULTS = 32;
const MAX_AI_CANDIDATES = 28;
export const maxDuration = 60;
const MAX_FETCH_BYTES = 15 * 1024 * 1024;
const DEFAULT_MISTRAL_SEARCH_MODEL = "mistral-small-latest";
const DEFAULT_OPENROUTER_SEARCH_MODEL = "perplexity/sonar-pro";

const SWEEP_SYSTEM_PROMPT = `You are a mechanical engineering research agent. Find 20-24 real, publicly accessible mechanical engineering documents relevant to the user's query.

Return ONLY valid JSON with this shape:
{"results":[{"title":"...","url":"https://...","type":"pdf|txt|csv","description":"1 sentence","relevanceScore":0.0,"category":"..."}]}

Each result needs title, real https url, type (pdf|txt|csv), description, relevanceScore (0-1), and category from: Thermodynamics, Fluid Mechanics, Solid Mechanics, Materials Science, Manufacturing, Dynamics & Vibrations, Heat Transfer, Machine Design, FEA / FEM, Control Systems, Robotics, HVAC, Other.

Prefer university pages, NIST, NASA, manufacturer datasheets, and open textbooks. Include diverse sources.`;

function normalizeUrl(input: string): string | null {
  try {
    const trimmed = input.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function normalizeDocType(type: string, url: string): DocType {
  if (type === "pdf" || type === "txt" || type === "csv") return type;
  return detectDocTypeFromUrl(url);
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
    const fallbackType = normalizeDocType(result.type, finalUrl);
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

async function finalizeSweepResults(
  candidates: SweepResult[],
  options: { skipValidation?: boolean } = {}
): Promise<SweepResult[]> {
  if (options.skipValidation) {
    return candidates
      .slice()
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, MAX_RESULTS);
  }

  const settled = await Promise.all(candidates.map(validateSweepResult));
  return settled
    .filter((r): r is SweepResult => r !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, MAX_RESULTS);
}

async function searchWithMistral(query: string, excluded: string[]): Promise<SweepResult[]> {
  const userPrompt =
    excluded.length > 0
      ? `${query}\n\nAvoid these URLs because they are already in the user's current sweep/library:\n${excluded.join("\n")}`
      : query;

  const { text: rawText } = await callChatAI({
    mistralModel: process.env.MISTRAL_SEARCH_MODEL?.trim() ?? DEFAULT_MISTRAL_SEARCH_MODEL,
    openRouterModel:
      process.env.OPENROUTER_SEARCH_MODEL?.trim() ?? DEFAULT_OPENROUTER_SEARCH_MODEL,
    messages: [
      { role: "system", content: SWEEP_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 4500,
    temperature: 0.2,
    timeoutMs: 55000,
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
        type: normalizeDocType(r.type, url),
      };
    })
    .filter((r): r is SweepResult => r !== null)
    .slice(0, MAX_AI_CANDIDATES);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { query?: string; excludeUrls?: string[] };
    const query = body.query?.trim() || "Find mechanical engineering documents";
    const excluded = (body.excludeUrls ?? []).slice(0, 120);

    if (exaSearchEnabled()) {
      try {
        const exaCandidates = (await searchExa(query, excluded)).slice(0, MAX_AI_CANDIDATES);
        const results = await finalizeSweepResults(exaCandidates, { skipValidation: true });
        return NextResponse.json({ results, provider: "exa" });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Exa search failed";
        console.warn(`Exa search failed, falling back to Mistral: ${reason}`);
      }
    }

    const mistralCandidates = await searchWithMistral(query, excluded);
    const results = await finalizeSweepResults(mistralCandidates);
    return NextResponse.json({ results, provider: "mistral" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sweep failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
