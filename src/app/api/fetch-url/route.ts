import { NextRequest, NextResponse } from "next/server";
import {
  detectDocTypeFromContentType,
  detectDocTypeFromUrl,
  extractTextFromCsv,
  extractTextFromHtml,
  extractTextFromTxt,
} from "@/lib/parser";
import { parsePdfWithPages } from "@/lib/pdf";
import {
  detectLanguage,
  detectOcrStatus,
  detectUnits,
  extractTablesFromCsv as extractCsvTables,
  extractTablesFromHtml,
  extractTablesFromText,
} from "@/lib/processing";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchRemoteUrl,
  inferContentKind,
  isPdfBuffer,
} from "@/lib/fetch-document";
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

function getResponseSize(response: Response): number | null {
  const length = response.headers.get("content-length");
  if (!length) return null;
  const parsed = Number(length);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: NextRequest) {
  let url: string | undefined;
  try {
    const body = (await request.json()) as { url: string; type: DocType };

    if (!body.url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    try {
      url = normalizeUrl(body.url);
    } catch {
      return NextResponse.json(
        { error: `Invalid URL: ${body.url}. Enter a public http(s) URL.` },
        { status: 400 }
      );
    }

    const response = await fetchRemoteUrl(url, { timeoutMs: DEFAULT_FETCH_TIMEOUT_MS });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: failedStatusMessage(response.status, response.statusText, url) },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    const contentType = response.headers.get("content-type");
    if (!isSupportedContentType(contentType, url)) {
      return NextResponse.json(
        { error: unsupportedContentTypeMessage(contentType, url) },
        { status: 415 }
      );
    }

    const fallbackType = body.type ?? detectDocTypeFromUrl(url);
    const responseSize = getResponseSize(response);

    if (responseSize && responseSize > MAX_FETCH_BYTES) {
      return NextResponse.json(
        { error: oversizedDocumentMessage(responseSize) },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_FETCH_BYTES) {
      return NextResponse.json(
        { error: oversizedDocumentMessage(buffer.length) },
        { status: 413 }
      );
    }

    const kind = inferContentKind(contentType, url, buffer);
    const type =
      kind === "pdf"
        ? "pdf"
        : kind === "csv"
          ? "csv"
          : detectDocTypeFromContentType(contentType, fallbackType);

    if (type === "pdf" || isPdfBuffer(buffer)) {
      const data = await parsePdfWithPages(buffer);
      const tables = extractTablesFromText(data.text);

      return NextResponse.json({
        text: data.text,
        type: "pdf" as const,
        sizeBytes: buffer.length,
        pageCount: data.pageCount,
        pages: data.pages,
        tables,
        detectedLanguage: detectLanguage(data.text),
        detectedUnits: detectUnits(data.text),
        ocrStatus: detectOcrStatus(data.text, data.pageCount),
      });
    }

    const text = buffer.toString("utf8");
    const sizeBytes = buffer.length;

    if (type === "csv" || kind === "csv") {
      const { text: csvText, rowCount } = extractTextFromCsv(text);
      return NextResponse.json({
        text: csvText,
        type: "csv" as const,
        sizeBytes,
        rowCount,
        tables: extractCsvTables(text),
        detectedLanguage: detectLanguage(csvText),
        detectedUnits: detectUnits(csvText),
        ocrStatus: "not_needed",
      });
    }

    const isHtml = kind === "html" || contentType?.toLowerCase().includes("html");
    const extractedText = isHtml ? extractTextFromHtml(text) : extractTextFromTxt(text);

    if (!extractedText) {
      return NextResponse.json(
        { error: `Fetched URL but could not extract text: ${url}` },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: extractedText,
      type,
      sizeBytes,
      tables: isHtml ? extractTablesFromHtml(text) : extractTablesFromText(extractedText),
      detectedLanguage: detectLanguage(extractedText),
      detectedUnits: detectUnits(extractedText),
      ocrStatus: "not_needed",
    });
  } catch (error) {
    const { message, status } = fetchExceptionMessage(error, url);
    return NextResponse.json({ error: message }, { status });
  }
}
