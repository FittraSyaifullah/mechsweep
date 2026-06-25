import type { ExportOptions, MechDocument } from "@/types";

interface ExportDocument {
  id: string;
  title: string;
  type: string;
  source: string;
  url: string | null;
  category: string | null;
  tags: string[];
  summary: string | null;
  content: string;
  addedAt: string;
  contentHash: string | null;
  pageCount: number | null;
  pages: MechDocument["pages"];
  tables: MechDocument["tables"];
  detectedLanguage: string | null;
  detectedUnits: string[];
  ocrStatus: MechDocument["ocrStatus"] | null;
}

interface ExportPayload {
  version: string;
  exportedAt: string;
  preset: ExportOptions["preset"];
  manifest: ExportManifest;
  count: number;
  documents: ExportDocument[];
  chunks: PresetChunk[];
}

interface ExportManifest {
  app: string;
  version: string;
  exportedAt: string;
  preset: ExportOptions["preset"];
  documentCount: number;
  chunkCount: number;
  chunkSize: number;
  chunkOverlap: number;
  includes: {
    content: boolean;
    summaries: boolean;
    tags: boolean;
    metadata: boolean;
  };
}

interface BaseChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  metadata: Record<string, string | number | string[] | null>;
}

type PresetChunk =
  | BaseChunk
  | { pageContent: string; metadata: BaseChunk["metadata"] }
  | { text: string; metadata: BaseChunk["metadata"] }
  | {
      custom_id: string;
      method: "POST";
      url: "/v1/embeddings";
      body: {
        model: string;
        input: string;
        metadata: BaseChunk["metadata"];
      };
    };

function buildDocument(
  doc: MechDocument,
  options: ExportOptions
): ExportDocument {
  const base: ExportDocument = {
    id: doc.id,
    title: doc.title,
    type: doc.type,
    source: doc.source,
    url: doc.url ?? null,
    category: doc.category ?? null,
    tags: options.includeTags ? (doc.tags ?? []) : [],
    summary: options.includeSummaries ? (doc.summary ?? null) : null,
    content: options.includeContent ? doc.content : "",
    addedAt: doc.addedAt,
    contentHash: doc.contentHash ?? null,
    pageCount: doc.pageCount ?? null,
    pages: options.includeMetadata ? doc.pages : undefined,
    tables: options.includeMetadata ? doc.tables : undefined,
    detectedLanguage: doc.detectedLanguage ?? null,
    detectedUnits: doc.detectedUnits ?? [],
    ocrStatus: doc.ocrStatus ?? null,
  };
  return base;
}

function clampChunkOptions(options: ExportOptions): { size: number; overlap: number } {
  const size = Math.max(200, Math.min(8000, Math.floor(options.chunkSize || 1000)));
  const overlap = Math.max(0, Math.min(size - 1, Math.floor(options.chunkOverlap || 0)));
  return { size, overlap };
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + size).trim());
    const next = start + size - overlap;
    if (next <= start) break;
    start = next;
  }
  return chunks.filter(Boolean);
}

function baseMetadata(
  doc: MechDocument,
  chunkIndex: number,
  options: ExportOptions
): BaseChunk["metadata"] {
  if (!options.includeMetadata) return {};
  return {
    documentId: doc.id,
    title: doc.title,
    type: doc.type,
    source: doc.source,
    url: doc.url ?? null,
    category: doc.category ?? null,
    tags: options.includeTags ? (doc.tags ?? []) : [],
    summary: options.includeSummaries ? (doc.summary ?? null) : null,
    addedAt: doc.addedAt,
    contentHash: doc.contentHash ?? null,
    pageCount: doc.pageCount ?? null,
    detectedLanguage: doc.detectedLanguage ?? null,
    detectedUnits: doc.detectedUnits ?? [],
    ocrStatus: doc.ocrStatus ?? null,
    chunkIndex,
  };
}

function buildBaseChunks(documents: MechDocument[], options: ExportOptions): BaseChunk[] {
  if (!options.includeContent) return [];
  const { size, overlap } = clampChunkOptions(options);
  return documents.flatMap((doc) =>
    chunkText(doc.content, size, overlap).map((text, chunkIndex) => ({
      id: `${doc.id}::chunk-${chunkIndex}`,
      documentId: doc.id,
      chunkIndex,
      text,
      metadata: baseMetadata(doc, chunkIndex, options),
    }))
  );
}

function applyPreset(chunks: BaseChunk[], preset: ExportOptions["preset"]): PresetChunk[] {
  if (preset === "langchain") {
    return chunks.map((chunk) => ({
      pageContent: chunk.text,
      metadata: chunk.metadata,
    }));
  }
  if (preset === "llamaindex") {
    return chunks.map((chunk) => ({
      text: chunk.text,
      metadata: chunk.metadata,
    }));
  }
  if (preset === "openai") {
    return chunks.map((chunk) => ({
      custom_id: chunk.id,
      method: "POST",
      url: "/v1/embeddings",
      body: {
        model: "text-embedding-3-small",
        input: chunk.text,
        metadata: chunk.metadata,
      },
    }));
  }
  return chunks;
}

function buildManifest(
  documents: MechDocument[],
  options: ExportOptions,
  chunkCount: number
): ExportManifest {
  const { size, overlap } = clampChunkOptions(options);
  return {
    app: "MechSweep",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    preset: options.preset,
    documentCount: documents.length,
    chunkCount,
    chunkSize: size,
    chunkOverlap: overlap,
    includes: {
      content: options.includeContent,
      summaries: options.includeSummaries,
      tags: options.includeTags,
      metadata: options.includeMetadata,
    },
  };
}

function buildPayload(documents: MechDocument[], options: ExportOptions): ExportPayload {
  const baseChunks = buildBaseChunks(documents, options);
  const chunks = applyPreset(baseChunks, options.preset);
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    preset: options.preset,
    manifest: buildManifest(documents, options, chunks.length),
    count: documents.length,
    documents: documents.map((d) => buildDocument(d, options)),
    chunks,
  };
}

export function exportToJson(
  documents: MechDocument[],
  options: ExportOptions
): string {
  return JSON.stringify(buildPayload(documents, options), null, 2);
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(
  documents: MechDocument[],
  options: ExportOptions
): string {
  const payload = buildPayload(documents, options);
  const headers = [
    "exportPreset",
    "chunkSize",
    "chunkOverlap",
    "id",
    "title",
    "type",
    "source",
    "url",
    "category",
    "addedAt",
  ];
  if (options.includeTags) headers.push("tags");
  if (options.includeSummaries) headers.push("summary");
  if (options.includeContent) headers.push("content");

  const rows = documents.map((doc) => {
    const fields: string[] = [
      payload.manifest.preset,
      String(payload.manifest.chunkSize),
      String(payload.manifest.chunkOverlap),
      doc.id,
      doc.title,
      doc.type,
      doc.source,
      doc.url ?? "",
      doc.category ?? "",
      doc.addedAt,
    ];
    if (options.includeTags) fields.push((doc.tags ?? []).join("; "));
    if (options.includeSummaries) fields.push(doc.summary ?? "");
    if (options.includeContent) fields.push(doc.content);
    return fields.map(escapeCsvField).join(",");
  });

  const chunkHeaders = ["chunkId", "documentId", "chunkIndex", "text", "metadata"];
  const chunkRows = buildBaseChunks(documents, options).map((chunk) =>
    [
      chunk.id,
      chunk.documentId,
      String(chunk.chunkIndex),
      chunk.text,
      JSON.stringify(chunk.metadata),
    ]
      .map(escapeCsvField)
      .join(",")
  );

  return [
    headers.join(","),
    ...rows,
    "",
    chunkHeaders.join(","),
    ...chunkRows,
  ].join("\n");
}

export function exportToTxt(
  documents: MechDocument[],
  options: ExportOptions
): string {
  const payload = buildPayload(documents, options);
  const manifestText = options.includeMetadata
    ? `Manifest:\n${JSON.stringify(payload.manifest, null, 2)}\n\n---\n\n`
    : "";
  const documentsText = documents
    .map((doc, index) => {
      const lines = [
        `Document ${index + 1}: ${doc.title}`,
        `ID: ${doc.id}`,
        `Type: ${doc.type}`,
        `Source: ${doc.source}`,
        `URL: ${doc.url ?? ""}`,
        `Category: ${doc.category ?? ""}`,
        `Added: ${doc.addedAt}`,
      ];

      if (options.includeTags) lines.push(`Tags: ${(doc.tags ?? []).join(", ")}`);
      if (options.includeSummaries) lines.push("", "Summary:", doc.summary ?? "");
      if (options.includeContent) lines.push("", "Content:", doc.content);

      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  const chunksText = buildBaseChunks(documents, options)
    .map((chunk) => `Chunk: ${chunk.id}\nMetadata: ${JSON.stringify(chunk.metadata)}\n\n${chunk.text}`)
    .join("\n\n---\n\n");

  return [manifestText + documentsText, chunksText ? `Chunks:\n${chunksText}` : ""]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: string, maxChars = 96): string[] {
  const lines: string[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function exportToPdf(
  documents: MechDocument[],
  options: ExportOptions
): string {
  const text = exportToTxt(documents, options);
  const lines = wrapText(text);
  const linesPerPage = 52;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(["No documents."]);

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const stream = [
      "BT",
      "/F1 10 Tf",
      "50 770 Td",
      "14 TL",
      ...pageLines.map((line) => `(${sanitizePdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");
    const contentId = addObject(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = "<< /Type /Catalog /Pages 2 0 R >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function slugifyExportFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Document path inside a folder export; padding scales with library size. */
export function buildDocumentExportPath(index: number, total: number, title: string): string {
  const width = Math.max(3, String(total).length);
  return `documents/${String(index + 1).padStart(width, "0")}-${
    slugifyExportFilename(title) || "document"
  }.txt`;
}

export function buildExportChunksForDocument(
  doc: MechDocument,
  options: ExportOptions
): PresetChunk[] {
  return applyPreset(buildBaseChunks([doc], options), options.preset);
}

export function buildExportManifest(
  documents: MechDocument[],
  options: ExportOptions,
  chunkCount: number
): ExportManifest {
  return buildManifest(documents, options, chunkCount);
}

export interface FolderCorpusIndex {
  version: string;
  format: "mechsweep-folder-v2";
  exportedAt: string;
  preset: ExportOptions["preset"];
  manifest: ExportManifest;
  count: number;
  chunksFile: string;
  documents: Array<ExportDocument & { exportPath: string }>;
}

/** Lightweight corpus index for folder exports (content lives in documents/*.txt). */
export function buildFolderCorpusIndex(
  documents: MechDocument[],
  options: ExportOptions,
  exportPaths: string[],
  chunkCount: number
): FolderCorpusIndex {
  const metadataOnly: ExportOptions = { ...options, includeContent: false };
  return {
    version: "1.0",
    format: "mechsweep-folder-v2",
    exportedAt: new Date().toISOString(),
    preset: options.preset,
    manifest: buildManifest(documents, options, chunkCount),
    count: documents.length,
    chunksFile: `${options.preset}-chunks.jsonl`,
    documents: documents.map((doc, index) => ({
      ...buildDocument(doc, metadataOnly),
      exportPath: exportPaths[index],
    })),
  };
}

export interface ExportArchiveFile {
  path: string;
  content: string;
}

/** Multi-file RAG export layout (same contents as the ZIP export, as paths). */
export function buildExportArchiveFiles(
  documents: MechDocument[],
  options: ExportOptions
): ExportArchiveFile[] {
  const payload = buildPayload(documents, options);
  return [
    {
      path: "manifest.json",
      content: JSON.stringify(payload.manifest, null, 2),
    },
    {
      path: `${options.preset}-chunks.jsonl`,
      content: payload.chunks.map((chunk) => JSON.stringify(chunk)).join("\n"),
    },
    {
      path: "corpus.json",
      content: JSON.stringify(payload, null, 2),
    },
    ...documents.map((doc, index) => ({
      path: buildDocumentExportPath(index, documents.length, doc.title),
      content: exportToTxt([doc], options),
    })),
  ];
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function uint16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function exportToZip(
  documents: MechDocument[],
  options: ExportOptions
): ArrayBuffer {
  const encoder = new TextEncoder();
  const files = buildExportArchiveFiles(documents, options);

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const common = [
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
    ];

    const localHeader = concatBytes([
      uint32(0x04034b50),
      ...common,
      uint16(0),
      nameBytes,
      data,
    ]);
    localParts.push(localHeader);

    centralParts.push(
      concatBytes([
        uint32(0x02014b50),
        uint16(20),
        ...common,
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        nameBytes,
      ])
    );

    offset += localHeader.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0),
  ]);

  const zipBytes = concatBytes([...localParts, centralDirectory, end]);
  const buffer = new ArrayBuffer(zipBytes.byteLength);
  new Uint8Array(buffer).set(zipBytes);
  return buffer;
}

export function downloadExport(
  content: BlobPart,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
