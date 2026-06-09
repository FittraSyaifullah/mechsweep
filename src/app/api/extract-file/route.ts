import { NextRequest, NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/document-extract";
import { detectDocType } from "@/lib/parser";
import type { DocType } from "@/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const requestedType = formData.get("type");
    const type =
      typeof requestedType === "string" && requestedType
        ? (requestedType as DocType)
        : detectDocType(file.name);

    if (!type) {
      return NextResponse.json({ error: `Unsupported file: ${file.name}` }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractDocumentText(type, buffer, file.name);

    if (!extracted.text.trim()) {
      return NextResponse.json(
        { error: `No readable text found in ${file.name}` },
        { status: 422 }
      );
    }

    return NextResponse.json({
      type,
      text: extracted.text,
      pageCount: extracted.pageCount,
      pages: extracted.pages,
      tables: extracted.tables,
      detectedLanguage: extracted.detectedLanguage,
      detectedUnits: extracted.detectedUnits,
      ocrStatus: extracted.ocrStatus,
      rowCount: extracted.rowCount,
      sizeBytes: file.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extract failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
