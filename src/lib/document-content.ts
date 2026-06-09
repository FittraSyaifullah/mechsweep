import { extractTextFromHtml, extractTextFromTxt } from "@/lib/parser";
import type { DocType } from "@/types";

export const MIN_USABLE_CONTENT_CHARS = 120;

export function normalizeImportedContent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^\s*</.test(trimmed)) {
    return extractTextFromHtml(trimmed) || extractTextFromTxt(trimmed);
  }

  return extractTextFromTxt(trimmed);
}

export function isUsableContent(
  raw: string,
  minChars: number = MIN_USABLE_CONTENT_CHARS
): boolean {
  return normalizeImportedContent(raw).length >= minChars;
}

export interface FetchedDocumentContent {
  text: string;
  type?: DocType;
  sizeBytes?: number;
  pageCount?: number;
  pages?: { pageNumber: number; text: string }[];
  tables?: { id: string; title?: string; headers: string[]; rows: string[][]; source: "csv" | "html" | "text" }[];
  detectedLanguage?: string;
  detectedUnits?: string[];
  ocrStatus?: "not_needed" | "needed" | "unsupported";
  rowCount?: number;
}

export async function fetchDocumentContent(
  url: string,
  type: DocType,
  fallbackText?: string
): Promise<FetchedDocumentContent> {
  const res = await fetch("/api/fetch-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      type,
      fallbackText: fallbackText?.trim() || undefined,
    }),
  });

  const data = (await res.json()) as FetchedDocumentContent & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Fetch failed");

  const text = normalizeImportedContent(data.text ?? "");
  if (!isUsableContent(text)) {
    throw new Error("Fetched URL but no readable text was found");
  }

  return { ...data, text };
}

export function buildPrefetchedContent(
  text?: string,
  highlights?: string[]
): string | undefined {
  const normalizedText = text ? normalizeImportedContent(text) : "";
  if (isUsableContent(normalizedText)) return normalizedText;

  const highlightText = normalizeImportedContent((highlights ?? []).join("\n\n"));
  if (isUsableContent(highlightText)) return highlightText;

  return normalizedText || highlightText || undefined;
}
