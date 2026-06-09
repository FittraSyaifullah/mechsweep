import JSZip from "jszip";
import { parsePdfWithPages } from "@/lib/pdf";
import {
  extractTextFromCsv,
  extractTextFromHtml,
  extractTextFromJson,
  extractTextFromMd,
  extractTextFromTxt,
} from "@/lib/parser";
import { docTypeFromExtension } from "@/lib/file-types";
import {
  detectLanguage,
  detectOcrStatus,
  detectUnits,
  extractTablesFromCsv,
  extractTablesFromText,
} from "@/lib/processing";
import type { DocType, DocumentPage, ExtractedTable, MechDocument } from "@/types";

const MAX_ZIP_ENTRIES = 40;
const MAX_ZIP_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_EXTRACT_CHARS = 120_000;

export interface ExtractedDocument {
  text: string;
  pageCount?: number;
  pages?: DocumentPage[];
  tables?: ExtractedTable[];
  detectedLanguage?: string;
  detectedUnits?: string[];
  ocrStatus?: MechDocument["ocrStatus"];
  rowCount?: number;
}

function clampText(text: string): string {
  if (text.length <= MAX_EXTRACT_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACT_CHARS)}\n\n[... truncated ...]`;
}

function decodeBytes(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;
  return buffer.toString("latin1");
}

export function extractPrintableStrings(buffer: Buffer, minLength = 4): string[] {
  const strings: string[] = [];
  let current = "";

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    const isPrintable =
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126);

    if (isPrintable) {
      current += String.fromCharCode(byte);
      continue;
    }

    if (current.length >= minLength) strings.push(current.trim());
    current = "";
  }

  if (current.length >= minLength) strings.push(current.trim());
  return strings;
}

function extractTextFromStl(buffer: Buffer): string {
  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString("utf8");
  if (/^\s*solid\b/i.test(head)) {
    return clampText(decodeBytes(buffer));
  }

  const header = buffer.subarray(0, 80).toString("utf8").replace(/\0/g, " ").trim();
  const strings = extractPrintableStrings(buffer);
  const body = strings.join("\n");
  return clampText([header && `Header: ${header}`, body].filter(Boolean).join("\n\n"));
}

function extractTextFromStep(buffer: Buffer): string {
  const text = decodeBytes(buffer);
  if (/ISO-10303-21/i.test(text)) {
    const lines = text.split(/\r?\n/);
    const picked = lines.filter((line) =>
      /^(ISO-10303-21|HEADER|FILE_DESCRIPTION|FILE_NAME|FILE_SCHEMA|DATA|#\d+|PRODUCT|MATERIAL|SHAPE|MANIFOLD|ADVANCED_BREP|CLOSED_SHELL|FACETED|MECHANICAL|DESIGN|APPLICATION|ORGANIZATION|PROPERTY)/i.test(
        line.trim()
      )
    );
    const excerpt = (picked.length > 0 ? picked : lines.slice(0, 400)).join("\n");
    return clampText(excerpt);
  }

  return clampText(extractPrintableStrings(buffer).join("\n"));
}

function extractTextFromDwg(buffer: Buffer): string {
  const header = buffer.subarray(0, 6).toString("utf8");
  const strings = extractPrintableStrings(buffer);
  return clampText(
    [`Format: ${header || "DWG"}`, ...strings].filter(Boolean).join("\n")
  );
}

async function extractZipArchive(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const chunks: string[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (chunks.length >= MAX_ZIP_ENTRIES) break;
    if (entry.dir) continue;

    const entryType = docTypeFromExtension(name);
    if (!entryType) continue;

    const data = await entry.async("uint8array");
    if (data.byteLength > MAX_ZIP_ENTRY_BYTES) continue;

    const nested = await extractDocumentText(entryType, Buffer.from(data), name);
    if (!nested.text.trim()) continue;

    chunks.push(`--- ${name} ---\n${nested.text}`);
  }

  if (chunks.length === 0) {
    throw new Error("ZIP archive has no supported text or CAD files");
  }

  return clampText(chunks.join("\n\n"));
}

function enrichText(text: string, partial: Partial<ExtractedDocument> = {}): ExtractedDocument {
  const trimmed = text.trim();
  return {
    text: clampText(trimmed),
    detectedLanguage: partial.detectedLanguage ?? detectLanguage(trimmed),
    detectedUnits: partial.detectedUnits ?? detectUnits(trimmed),
    ocrStatus: partial.ocrStatus ?? "not_needed",
    pageCount: partial.pageCount,
    pages: partial.pages,
    tables: partial.tables,
    rowCount: partial.rowCount,
  };
}

export async function extractDocumentText(
  type: DocType,
  buffer: Buffer,
  sourceName = ""
): Promise<ExtractedDocument> {
  switch (type) {
    case "pdf": {
      const data = await parsePdfWithPages(buffer);
      return enrichText(data.text, {
        pageCount: data.pageCount,
        pages: data.pages,
        tables: extractTablesFromText(data.text),
        ocrStatus: detectOcrStatus(data.text, data.pageCount),
      });
    }
    case "csv": {
      const raw = decodeBytes(buffer);
      const { text, rowCount } = extractTextFromCsv(raw);
      return enrichText(text, {
        rowCount,
        tables: extractTablesFromCsv(raw),
      });
    }
    case "json":
      return enrichText(extractTextFromJson(decodeBytes(buffer)));
    case "md":
      return enrichText(extractTextFromMd(decodeBytes(buffer)));
    case "txt": {
      const raw = decodeBytes(buffer);
      const isHtml = /^\s*</.test(raw.trim());
      const text = isHtml ? extractTextFromHtml(raw) : extractTextFromTxt(raw);
      return enrichText(text);
    }
    case "zip":
      return enrichText(await extractZipArchive(buffer));
    case "stl":
      return enrichText(extractTextFromStl(buffer), { ocrStatus: "unsupported" });
    case "step":
      return enrichText(extractTextFromStep(buffer), { ocrStatus: "unsupported" });
    case "dwg":
      return enrichText(extractTextFromDwg(buffer), { ocrStatus: "unsupported" });
    default:
      throw new Error(`Unsupported document type${sourceName ? `: ${sourceName}` : ""}`);
  }
}
