import { extractTextFromHtml, extractTextFromTxt } from "@/lib/parser";
import { hasDirectDocumentUrl } from "@/lib/file-types";
import type { DocType } from "@/types";

export const MIN_USABLE_CONTENT_CHARS = 120;
export const MIN_RECOVERY_CONTENT_CHARS = 40;

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

export function combineFallbackSources(...parts: Array<string | undefined>): string {
  return parts
    .map((part) => (part ? normalizeImportedContent(part) : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function shouldSkipDirectFetch(url: string, prefetched: string): boolean {
  if (!isUsableContent(prefetched)) return false;
  return !hasDirectDocumentUrl(url);
}

export interface FetchedDocumentContent {
  text: string;
  type?: DocType;
  sizeBytes?: number;
  pageCount?: number;
  pages?: { pageNumber: number; text: string }[];
  tables?: {
    id: string;
    title?: string;
    headers: string[];
    rows: string[][];
    source: "csv" | "html" | "text";
  }[];
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
  if (!text) {
    throw new Error("Fetched URL but no readable text was found");
  }

  return { ...data, text };
}

export function buildPrefetchedContent(
  text?: string,
  highlights?: string[],
  description?: string
): string | undefined {
  const normalizedText = text ? normalizeImportedContent(text) : "";
  const highlightText = normalizeImportedContent((highlights ?? []).join("\n\n"));
  const descriptionText = description ? normalizeImportedContent(description) : "";
  const combined = combineFallbackSources(normalizedText, highlightText, descriptionText);

  if (isUsableContent(combined)) return combined;
  if (isUsableContent(normalizedText)) return normalizedText;
  if (isUsableContent(highlightText)) return highlightText;
  if (isUsableContent(descriptionText)) return descriptionText;

  return combined || normalizedText || highlightText || descriptionText || undefined;
}

export function recoverContentFromSources(
  ...parts: Array<string | undefined>
): string | null {
  const combined = combineFallbackSources(...parts);
  if (combined.length >= MIN_RECOVERY_CONTENT_CHARS) return combined;
  return null;
}
