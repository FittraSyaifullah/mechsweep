import { NextRequest, NextResponse } from "next/server";
import {
  isUsableContent,
  normalizeImportedContent,
} from "@/lib/document-content";
import { extractDocumentText } from "@/lib/document-extract";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchDocumentBuffer,
  inferContentKind,
  isPdfBuffer,
  isZipBuffer,
} from "@/lib/fetch-document";
import { docTypeFromExtension } from "@/lib/file-types";
import {
  detectDocTypeFromContentType,
  detectDocTypeFromUrl,
} from "@/lib/parser";
import {
  detectLanguage,
  detectUnits,
  extractTablesFromHtml,
} from "@/lib/processing";
import {
  failedStatusMessage,
  fetchExceptionMessage,
  isSupportedContentType,
  MAX_FETCH_BYTES,
  oversizedDocumentMessage,
  unsupportedContentTypeMessage,
} from "@/lib/fetch-errors";
import type { DocType } from "@/types";

export const maxDuration = 60;

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

function fallbackPayload(
  fallbackText: string | undefined,
  type: DocType,
  finalUrl: string
) {
  const text = fallbackText ? normalizeImportedContent(fallbackText) : "";
  if (!isUsableContent(text)) return null;

  return {
    text,
    type,
    detectedLanguage: detectLanguage(text),
    detectedUnits: detectUnits(text),
    ocrStatus: "not_needed" as const,
    sourceUrl: finalUrl,
    fromFallback: true,
  };
}

function resolveDocType(
  finalUrl: string,
  contentType: string | null,
  buffer: Buffer,
  requestedType: DocType,
  kind: ReturnType<typeof inferContentKind>
): DocType {
  if (isPdfBuffer(buffer) || kind === "pdf") return "pdf";
  if (isZipBuffer(buffer)) return "zip";

  const fromUrl = docTypeFromExtension(finalUrl);
  if (fromUrl) return fromUrl;

  if (kind === "csv") return "csv";

  const fromContentType = detectDocTypeFromContentType(contentType, requestedType);
  if (fromContentType !== "txt" || kind !== "html") return fromContentType;

  return requestedType ?? detectDocTypeFromUrl(finalUrl);
}

export async function POST(request: NextRequest) {
  let url: string | undefined;
  let fallbackText: string | undefined;
  let requestedType: DocType = "pdf";
  try {
    const body = (await request.json()) as {
      url: string;
      type: DocType;
      fallbackText?: string;
    };

    if (!body.url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    fallbackText = body.fallbackText;
    requestedType = body.type ?? "pdf";

    try {
      url = normalizeUrl(body.url);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL: ${body.url}. Enter a public http(s) URL.` },
        { status: 400 }
      );
    }

    const { buffer, contentType, finalUrl } = await fetchDocumentBuffer(url, {
      timeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    });

    if (buffer.length > MAX_FETCH_BYTES) {
      const oversizedFallback = fallbackPayload(fallbackText, requestedType, finalUrl);
      if (oversizedFallback) return NextResponse.json(oversizedFallback);

      return NextResponse.json(
        { error: oversizedDocumentMessage(buffer.length) },
        { status: 413 }
      );
    }

    const kind = inferContentKind(contentType, finalUrl, buffer);
    if (kind === "unknown" && !isSupportedContentType(contentType, finalUrl)) {
      const unsupportedFallback = fallbackPayload(fallbackText, requestedType, finalUrl);
      if (unsupportedFallback) return NextResponse.json(unsupportedFallback);

      return NextResponse.json(
        { error: unsupportedContentTypeMessage(contentType, finalUrl) },
        { status: 415 }
      );
    }

    const type = resolveDocType(finalUrl, contentType, buffer, requestedType, kind);
    const extracted = await extractDocumentText(type, buffer, finalUrl);

    if (!extracted.text.trim()) {
      const emptyFallback = fallbackPayload(fallbackText, type, finalUrl);
      if (emptyFallback) return NextResponse.json(emptyFallback);

      return NextResponse.json(
        { error: `Fetched URL but could not extract text: ${finalUrl}` },
        { status: 422 }
      );
    }

    const isHtml = kind === "html" || contentType?.toLowerCase().includes("html");

    return NextResponse.json({
      text: extracted.text,
      type,
      sizeBytes: buffer.length,
      pageCount: extracted.pageCount,
      pages: extracted.pages,
      tables:
        extracted.tables ??
        (isHtml ? extractTablesFromHtml(buffer.toString("utf8")) : undefined),
      detectedLanguage: extracted.detectedLanguage,
      detectedUnits: extracted.detectedUnits,
      ocrStatus: extracted.ocrStatus,
      rowCount: extracted.rowCount,
    });
  } catch (error) {
    const fallback = fallbackPayload(fallbackText, requestedType, url ?? "");
    if (fallback) return NextResponse.json(fallback);

    if (error instanceof Error && /^Fetch failed \(\d+\)$/.test(error.message)) {
      const status = Number(error.message.match(/\d+/)?.[0] ?? 502);
      return NextResponse.json(
        { error: failedStatusMessage(status, "", url ?? "") },
        { status: status === 404 ? 404 : 502 }
      );
    }

    const { message, status } = fetchExceptionMessage(error, url);
    return NextResponse.json({ error: message }, { status });
  }
}
