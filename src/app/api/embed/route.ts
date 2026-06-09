import { NextRequest, NextResponse } from "next/server";
import { callEmbeddingAI } from "@/lib/ai";

const EMBED_CONTENT_CHARS = 6000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const embedding = await callEmbeddingAI(text.slice(0, EMBED_CONTENT_CHARS));
    return NextResponse.json({ embedding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
