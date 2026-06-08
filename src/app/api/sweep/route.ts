import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";
import {
  detectDocTypeFromContentType,
  detectDocTypeFromUrl,
  parseJsonFromResponse,
} from "@/lib/parser";
import type { DocType, SweepResult } from "@/types";

const VALIDATE_TIMEOUT_MS = 12000;
const MAX_RESULTS = 12;
const MAX_FETCH_BYTES = 15 * 1024 * 1024;
const DEFAULT_SEARCH_MODEL = "perplexity/sonar-pro";

const SWEEP_SYSTEM_PROMPT = `You are a mechanical engineering research agent. Find 8-12 real, publicly accessible mechanical engineering documents (PDFs, technical reports, datasheets, textbooks, standards summaries, or CSV datasets) relevant to the user's query.

Return ONLY a valid JSON array — no markdown, no preamble, no explanation. Each element must have:
- "title": string
- "url": string (a real https URL, not an example, placeholder, invented URL, or citation-only title)
- "type": "pdf" | "txt" | "csv"
- "description": string (1-2 sentences)
- "relevanceScore": number (0.0 to 1.0)
- "category": one of: Thermodynamics, Fluid Mechanics, Solid Mechanics, Materials Science, Manufacturing, Dynamics & Vibrations, Heat Transfer, Machine Design, FEA / FEM, Control Systems, Robotics, HVAC, Other

Prefer authoritative sources: university course pages, NIST, NASA, manufacturer datasheets, open textbooks, and government technical archives. Do not return URLs you cannot verify as reachable.`;

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
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept:
          "application/pdf,text/csv,text/plain,text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Range: "bytes=0-4095",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 MechSweep/1.0",
      },
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() || "Find mechanical engineering documents";

    const rawText = await callOpenRouter({
      model: process.env.OPENROUTER_SEARCH_MODEL ?? DEFAULT_SEARCH_MODEL,
      messages: [
        { role: "system", content: SWEEP_SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      maxTokens: 2000,
      temperature: 0.2,
    });

    const parsed = parseJsonFromResponse<SweepResult[]>(rawText);

    const candidates = parsed
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
        return {
          ...r,
          url,
          type: normalizeDocType(r.type, url),
        };
      })
      .filter((r): r is SweepResult => r !== null)
      .slice(0, MAX_RESULTS);

    const settled = await Promise.all(candidates.map(validateSweepResult));
    const results = settled
      .filter((r): r is SweepResult => r !== null)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, MAX_RESULTS);

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sweep failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
