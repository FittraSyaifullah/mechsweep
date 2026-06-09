import { parse as parseCsv } from "csv-parse/sync";
import { docTypeFromExtension, isDocType } from "@/lib/file-types";
import type { DocType } from "@/types";

export function detectDocType(filename: string): DocType | null {
  return docTypeFromExtension(filename);
}

export function detectDocTypeFromUrl(url: string): DocType {
  return docTypeFromExtension(url) ?? "txt";
}

export function detectDocTypeFromContentType(
  contentType: string | null,
  fallback: DocType
): DocType {
  const lower = contentType?.toLowerCase() ?? "";
  if (lower.includes("application/pdf")) return "pdf";
  if (lower.includes("text/csv") || lower.includes("application/csv")) return "csv";
  if (lower.includes("application/json") || lower.includes("+json")) return "json";
  if (lower.includes("text/markdown")) return "md";
  if (lower.includes("application/zip") || lower.includes("application/x-zip-compressed"))
    return "zip";
  if (lower.includes("model/stl") || lower.includes("application/sla")) return "stl";
  if (lower.includes("model/step") || lower.includes("application/step")) return "step";
  if (lower.includes("application/acad") || lower.includes("image/vnd.dwg")) return "dwg";
  if (lower.includes("text/html") || lower.includes("application/xhtml+xml")) return "txt";
  if (lower.includes("text/plain")) return "txt";
  return fallback;
}

export function normalizeDocType(type: string, url: string): DocType {
  if (isDocType(type)) return type;
  return detectDocTypeFromUrl(url);
}

export function extractTextFromTxt(content: string): string {
  return content.trim();
}

export function extractTextFromMd(content: string): string {
  return content
    .replace(/^---[\s\S]*?---\n?/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function flattenJson(value: unknown, prefix = ""): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${prefix}${String(value)}\n`;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => flattenJson(item, `${prefix}[${index}] `)).join("");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => flattenJson(nested, `${prefix}${key}: `))
      .join("");
  }
  return `${prefix}${String(value)}\n`;
}

export function extractTextFromJson(content: string): string {
  try {
    return flattenJson(JSON.parse(content)).trim();
  } catch {
    return extractTextFromTxt(content);
  }
}

export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTextFromCsv(content: string): { text: string; rowCount: number } {
  const records = parseCsv(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const lines = records.map((row, i) => {
    const fields = Object.entries(row)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    return `Row ${i + 1}: ${fields}`;
  });

  return { text: lines.join("\n"), rowCount: records.length };
}

export function truncateContent(content: string, maxChars = 8000): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "\n\n[... truncated ...]";
}

export function extractJsonFromResponse(raw: string): string {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  const startObj = text.indexOf("{");
  const startArr = text.indexOf("[");
  let start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);

  if (start >= 0) {
    const open = text[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === open) depth++;
      if (char === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  return text;
}

export function parseJsonFromResponse<T>(raw: string): T {
  const jsonStr = extractJsonFromResponse(raw);
  return JSON.parse(jsonStr) as T;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
