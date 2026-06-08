import { parse as parseCsv } from "csv-parse/sync";
import type { ExtractedTable } from "@/types";

const UNIT_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "mm", pattern: /\b\d+(?:\.\d+)?\s?mm\b/i },
  { label: "cm", pattern: /\b\d+(?:\.\d+)?\s?cm\b/i },
  { label: "m", pattern: /\b\d+(?:\.\d+)?\s?m\b/i },
  { label: "in", pattern: /\b\d+(?:\.\d+)?\s?(?:in|inch|inches)\b/i },
  { label: "ft", pattern: /\b\d+(?:\.\d+)?\s?(?:ft|feet)\b/i },
  { label: "N", pattern: /\b\d+(?:\.\d+)?\s?N\b/ },
  { label: "kN", pattern: /\b\d+(?:\.\d+)?\s?kN\b/i },
  { label: "Pa", pattern: /\b\d+(?:\.\d+)?\s?(?:Pa|kPa|MPa|GPa)\b/i },
  { label: "C", pattern: /\b\d+(?:\.\d+)?\s?(?:°C|C)\b/ },
  { label: "F", pattern: /\b\d+(?:\.\d+)?\s?(?:°F|F)\b/ },
  { label: "rpm", pattern: /\b\d+(?:\.\d+)?\s?rpm\b/i },
  { label: "Hz", pattern: /\b\d+(?:\.\d+)?\s?Hz\b/i },
  { label: "W", pattern: /\b\d+(?:\.\d+)?\s?(?:W|kW|MW)\b/ },
  { label: "kg", pattern: /\b\d+(?:\.\d+)?\s?kg\b/i },
];

const LANGUAGE_HINTS: { language: string; pattern: RegExp }[] = [
  { language: "English", pattern: /\b(the|and|with|pressure|temperature|flow|stress)\b/i },
  { language: "Spanish", pattern: /\b(el|la|los|las|con|presión|temperatura)\b/i },
  { language: "French", pattern: /\b(le|la|les|avec|pression|température)\b/i },
  { language: "German", pattern: /\b(der|die|das|mit|druck|temperatur)\b/i },
];

export function detectUnits(text: string): string[] {
  return UNIT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

export function detectLanguage(text: string): string {
  const sample = text.slice(0, 5000);
  return LANGUAGE_HINTS.find(({ pattern }) => pattern.test(sample))?.language ?? "Unknown";
}

export function detectOcrStatus(text: string, pageCount?: number): "not_needed" | "needed" {
  if (!pageCount) return "not_needed";
  const charsPerPage = text.trim().length / pageCount;
  return charsPerPage < 40 ? "needed" : "not_needed";
}

export function extractTablesFromCsv(content: string): ExtractedTable[] {
  const records = parseCsv(content, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][];

  if (records.length < 2) return [];
  const [headers, ...rows] = records;
  return [
    {
      id: "csv-table-1",
      title: "CSV table",
      headers: headers.map(String),
      rows: rows.map((row) => row.map(String)),
      source: "csv",
    },
  ];
}

export function extractTablesFromHtml(html: string): ExtractedTable[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const extracted = tables
    .map((table, index): ExtractedTable | null => {
      const rows = Array.from(table.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((rowMatch) =>
        Array.from(rowMatch[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((cell) =>
          cell[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        )
      );
      if (rows.length < 2) return null;
      const [headers, ...bodyRows] = rows;
      return {
        id: `html-table-${index + 1}`,
        title: `HTML table ${index + 1}`,
        headers,
        rows: bodyRows,
        source: "html" as const,
      };
    })
    .filter((table): table is ExtractedTable => table !== null);
  return extracted;
}

export function extractTablesFromText(text: string): ExtractedTable[] {
  const candidateRows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") || /\s{2,}/.test(line))
    .map((line) => line.split(line.includes("|") ? "|" : /\s{2,}/).map((cell) => cell.trim()))
    .filter((row) => row.length >= 3);

  if (candidateRows.length < 2) return [];
  const [headers, ...rows] = candidateRows.slice(0, 25);
  return [
    {
      id: "text-table-1",
      title: "Detected text table",
      headers,
      rows,
      source: "text",
    },
  ];
}
