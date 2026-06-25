import { describe, expect, it } from "vitest";
import {
  buildExportArchiveFiles,
  buildDocumentExportPath,
  buildFolderCorpusIndex,
  exportToCsv,
  exportToJson,
  exportToPdf,
  exportToTxt,
  exportToZip,
} from "@/lib/exporter";
import type { ExportOptions, MechDocument } from "@/types";

const options: ExportOptions = {
  format: "json",
  preset: "plain",
  chunkSize: 8,
  chunkOverlap: 2,
  includeMetadata: true,
  includeContent: true,
  includeSummaries: true,
  includeTags: true,
};

const docs: MechDocument[] = [
  {
    id: "doc-1",
    title: "Pump curves",
    type: "txt",
    source: "upload",
    content: "Flow and head data",
    summary: "Pump curve reference",
    tags: ["pump", "flow"],
    category: "Fluid Mechanics",
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
  },
];

describe("exporter", () => {
  it("exports JSON payloads", () => {
    const payload = JSON.parse(exportToJson(docs, options)) as {
      count: number;
      manifest: { preset: string; chunkCount: number };
      chunks: unknown[];
    };
    expect(payload.count).toBe(1);
    expect(payload.manifest.preset).toBe("plain");
    expect(payload.manifest.chunkCount).toBeGreaterThan(0);
    expect(payload.chunks.length).toBe(payload.manifest.chunkCount);
  });

  it("exports CSV and TXT content", () => {
    expect(exportToCsv(docs, options)).toContain("exportPreset");
    expect(exportToCsv(docs, options)).toContain("Pump curves");
    expect(exportToTxt(docs, options)).toContain("Manifest:");
    expect(exportToTxt(docs, options)).toContain("Flow and head data");
  });

  it("exports preset-specific JSON chunks", () => {
    const langchain = JSON.parse(
      exportToJson(docs, { ...options, preset: "langchain" })
    ) as { chunks: { pageContent?: string }[] };
    expect(langchain.chunks[0].pageContent).toBeTruthy();

    const openai = JSON.parse(
      exportToJson(docs, { ...options, preset: "openai" })
    ) as { chunks: { custom_id?: string; body?: { input: string } }[] };
    expect(openai.chunks[0].custom_id).toContain("doc-1");
    expect(openai.chunks[0].body?.input).toBeTruthy();
  });

  it("exports PDF and ZIP bytes", () => {
    expect(exportToPdf(docs, options).startsWith("%PDF-1.4")).toBe(true);

    const zip = new Uint8Array(exportToZip(docs, options));
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("builds multi-file archive layout for folder export", () => {
    const files = buildExportArchiveFiles(docs, options);
    expect(files.map((file) => file.path)).toEqual([
      "manifest.json",
      "plain-chunks.jsonl",
      "corpus.json",
      "documents/001-pump-curves.txt",
    ]);
  });

  it("pads document paths for large libraries", () => {
    expect(buildDocumentExportPath(0, 1, "A")).toBe("documents/001-a.txt");
    expect(buildDocumentExportPath(999, 1000, "B")).toBe("documents/1000-b.txt");
    expect(buildDocumentExportPath(0, 25000, "C")).toBe("documents/00001-c.txt");
  });

  it("builds a lightweight folder corpus index", () => {
    const paths = [buildDocumentExportPath(0, docs.length, docs[0].title)];
    const index = buildFolderCorpusIndex(docs, options, paths, 2);
    expect(index.format).toBe("mechsweep-folder-v2");
    expect(index.documents[0].exportPath).toBe(paths[0]);
    expect(index.documents[0].content).toBe("");
  });
});
