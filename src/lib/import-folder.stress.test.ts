import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { buildDocumentExportPath, buildFolderCorpusIndex } from "@/lib/exporter";
import { importDocumentsFromFileMap } from "@/lib/import-folder";
import { saveDocuments, loadDocuments } from "@/lib/storage";
import { resetOpfsProbeForTests, setDocumentBlobStoreForTests } from "@/lib/document-blobs";
import type { ExportOptions, MechDocument } from "@/types";

const DOC_COUNT = 8017;

const exportOptions: ExportOptions = {
  format: "txt",
  preset: "plain",
  chunkSize: 1000,
  chunkOverlap: 150,
  includeMetadata: true,
  includeContent: true,
  includeSummaries: true,
  includeTags: true,
};

function buildMinimalExportTxt(index: number, id: string, title: string): string {
  return [
    `Document 1: ${title}`,
    `ID: ${id}`,
    "Type: txt",
    "Source: sweep",
    "URL: ",
    "Category: Machine Design",
    "Added: 2026-01-01T00:00:00.000Z",
    "Tags: stress-test",
    "",
    "Summary:",
    "Stress test document",
    "",
    "Content:",
    `Engineering reference content for document ${index}. `.repeat(12),
  ].join("\n");
}

function buildExportFileMap(count: number): Map<string, string> {
  const documents: MechDocument[] = [];
  const exportPaths: string[] = [];
  const fileMap = new Map<string, string>();

  for (let index = 0; index < count; index++) {
    const id = `stress-doc-${index}`;
    const title = `Stress document ${index + 1}`;
    const exportPath = buildDocumentExportPath(index, count, title);
    exportPaths.push(exportPath);
    documents.push({
      id,
      title,
      type: "txt",
      source: "sweep",
      content: `Engineering reference content for document ${index}. `.repeat(12),
      summary: "Stress test document",
      tags: ["stress-test"],
      category: "Machine Design",
      addedAt: "2026-01-01T00:00:00.000Z",
      status: "ready",
    });
    fileMap.set(exportPath, buildMinimalExportTxt(index, id, title));
  }

  const corpus = buildFolderCorpusIndex(documents, exportOptions, exportPaths, count * 2);
  fileMap.set("corpus.json", JSON.stringify(corpus));
  return fileMap;
}

function setupIndexedDb() {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", { ...globalThis, isSecureContext: true });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  setDocumentBlobStoreForTests(null);
  resetOpfsProbeForTests();
}

describe("8017-document library stress", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setupIndexedDb();
  });

  it(
    "imports 8017 documents from a mechsweep-folder-v2 export layout",
    async () => {
      const fileMap = buildExportFileMap(DOC_COUNT);
      expect(fileMap.size).toBe(DOC_COUNT + 1);

      const started = performance.now();
      const result = await importDocumentsFromFileMap(fileMap, (progress) => {
        if (progress.phase === "reading") {
          void progress.completed;
        }
      });

      const importMs = performance.now() - started;

      expect(result.documents).toHaveLength(DOC_COUNT);
      expect(result.skippedFiles).toBe(0);
      expect(DOC_COUNT).toBeLessThanOrEqual(MAX_LIBRARY_DOCUMENTS);

      console.info(
        `[stress] import ${DOC_COUNT} docs: ${importMs.toFixed(0)}ms (${(importMs / DOC_COUNT).toFixed(2)}ms/doc)`
      );
    },
    120_000
  );

  it(
    "persists 8017 documents to IndexedDB",
    async () => {
      const documents: MechDocument[] = Array.from({ length: DOC_COUNT }, (_, index) => ({
        id: `persist-${index}`,
        title: `Persist ${index + 1}`,
        type: "txt" as const,
        source: "sweep" as const,
        content: `Stored content ${index}`,
        summary: "Stress",
        category: "Other",
        addedAt: "2026-01-01T00:00:00.000Z",
        status: "ready" as const,
      }));

      const started = performance.now();
      await saveDocuments(documents);
      const saved = await loadDocuments();
      const persistMs = performance.now() - started;

      expect(saved).toHaveLength(DOC_COUNT);
      console.info(`[stress] persist ${DOC_COUNT} docs: ${persistMs.toFixed(0)}ms`);
    },
    120_000
  );
});
