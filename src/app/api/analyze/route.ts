import { NextRequest, NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";
import { parseJsonFromResponse, truncateContent } from "@/lib/parser";
import type { AnalyzeResult } from "@/types";
import { ME_CATEGORIES } from "@/types";

const ANALYZE_CONTENT_CHARS = 3500;
const DEFAULT_ANALYZE_MODEL = "google/gemini-2.5-flash-lite";

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

    if (!body.content || !body.title) {
      return NextResponse.json(
        { error: "content and title are required" },
        { status: 400 }
      );
    }

    const truncated = truncateContent(body.content, ANALYZE_CONTENT_CHARS);

    const rawText = await callOpenRouter({
      model: process.env.OPENROUTER_ANALYZE_MODEL ?? DEFAULT_ANALYZE_MODEL,
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

    return NextResponse.json({
      summary: result.summary ?? "",
      tags: result.tags ?? [],
      category: result.category ?? "Other",
      keyTopics: result.keyTopics ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
