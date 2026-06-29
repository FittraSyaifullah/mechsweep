import { NextRequest, NextResponse } from "next/server";
import { MAX_SERVER_EXTRACT_BYTES } from "@/lib/constants";
import { formatMegabytes } from "@/lib/fetch-errors";
import { parsePdfWithPages } from "@/lib/pdf";
import {
  detectLanguage,
  detectOcrStatus,
  detectUnits,
  extractTablesFromText,
} from "@/lib/processing";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SERVER_EXTRACT_BYTES) {
      return NextResponse.json(
        {
          error: `PDF is too large (${formatMegabytes(file.size)}). Server limit is ${formatMegabytes(MAX_SERVER_EXTRACT_BYTES)}.`,
        },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await parsePdfWithPages(buffer);
    const tables = extractTablesFromText(data.text);

    return NextResponse.json({
      text: data.text,
      pageCount: data.pageCount,
      pages: data.pages,
      tables,
      detectedLanguage: detectLanguage(data.text),
      detectedUnits: detectUnits(data.text),
      ocrStatus: detectOcrStatus(data.text, data.pageCount),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
