import { parse as parseCsv } from "csv-parse/sync";
import type { DocType } from "@/types";

export function detectDocType(filename: string): DocType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  if (ext === "csv") return "csv";
  return null;
}

export function detectDocTypeFromUrl(url: string): DocType {
  const lower = url.toLowerCase();
  const pathname = lower.split("?")[0].split("#")[0];
  if (pathname.endsWith(".pdf")) return "pdf";
  if (pathname.endsWith(".csv")) return "csv";
  return "txt";
}

export function detectDocTypeFromContentType(
  contentType: string | null,
  fallback: DocType
): DocType {
  const lower = contentType?.toLowerCase() ?? "";
  if (lower.includes("application/pdf")) return "pdf";
  if (lower.includes("text/csv") || lower.includes("application/csv")) return "csv";
  if (lower.includes("text/html") || lower.includes("application/xhtml+xml")) return "txt";
  if (lower.includes("text/plain")) return "txt";
  return fallback;
}

export function extractTextFromTxt(content: string): string {
  return content.trim();
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
