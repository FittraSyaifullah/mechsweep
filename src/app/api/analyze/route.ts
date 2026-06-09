import { NextRequest, NextResponse } from "next/server";
import { callChatAI } from "@/lib/ai";
import { buildLocalAnalyzeResult } from "@/lib/document-analysis";
import { parseJsonFromResponse, truncateContent } from "@/lib/parser";
import type { AnalyzeResult } from "@/types";
import { ME_CATEGORIES } from "@/types";

const ANALYZE_CONTENT_CHARS = 3500;
const DEFAULT_MISTRAL_ANALYZE_MODEL = "mistral-small-latest";
const DEFAULT_OPENROUTER_ANALYZE_MODEL = "google/gemini-2.5-flash-lite";

const ANALYZE_SYSTEM_PROMPT = `Mechanical engineering document classifier. Return ONLY compact JSON:

{
  "summary": "one concise sentence",
  "tags": ["3-6 short tags"],
  "category": "allowed category",
  "keyTopics": ["2-4 topics"]
}

Allowed categories: ${ME_CATEGORIES.join(", ")}`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      content: string;
      title: string;
      type: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const content = body.content?.trim() ?? "";
    if (!content) {
      const fallback = buildLocalAnalyzeResult(body.title, body.type ?? "txt", "");
      return NextResponse.json({ ...fallback, provider: "local", fallback: true });
    }

    const truncated = truncateContent(content, ANALYZE_CONTENT_CHARS);

    try {
      const { text: rawText, provider } = await callChatAI({
        mistralModel: process.env.MISTRAL_ANALYZE_MODEL?.trim() ?? DEFAULT_MISTRAL_ANALYZE_MODEL,
        openRouterModel:
          process.env.OPENROUTER_ANALYZE_MODEL?.trim() ?? DEFAULT_OPENROUTER_ANALYZE_MODEL,
        messages: [
          { role: "system", content: ANALYZE_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Title: ${body.title}\nType: ${body.type}\n\nContent:\n${truncated}`,
          },
        ],
        maxTokens: 500,
        temperature: 0.1,
        responseFormat: { type: "json_object" },
        timeoutMs: 20000,
      });

      const result = parseJsonFromResponse<AnalyzeResult>(rawText);
      if (!result.summary && !result.tags?.length && !result.category) {
        throw new Error("Analysis returned empty structured data");
      }

      return NextResponse.json({
        summary: result.summary ?? "",
        tags: result.tags ?? [],
        category: result.category ?? "Other",
        keyTopics: result.keyTopics ?? [],
        provider,
      });
    } catch (aiError) {
      console.warn(
        `AI analyze failed, using local metadata: ${
          aiError instanceof Error ? aiError.message : "unknown error"
        }`
      );
      const fallback = buildLocalAnalyzeResult(body.title, body.type ?? "txt", content);
      return NextResponse.json({ ...fallback, provider: "local", fallback: true });
    }
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Analysis returned invalid JSON"
        : error instanceof Error
          ? error.message
          : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
