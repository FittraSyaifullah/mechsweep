import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportOptions, MechDocument } from "@/types";
import { exportDocumentsToFolder, isFolderExportSupported } from "@/lib/export-folder";
import { buildDocumentExportPath, buildExportArchiveFiles } from "@/lib/exporter";

const options: ExportOptions = {
  format: "json",
  preset: "plain",
  chunkSize: 1000,
  chunkOverlap: 150,
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
    tags: ["pump"],
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
  },
  {
    id: "doc-2",
    title: "Valve spec",
    type: "txt",
    source: "upload",
    content: "Pressure ratings",
    addedAt: "2026-01-02T00:00:00.000Z",
    status: "ready",
  },
];

function createMockDirectory() {
  const files = new Map<string, string>();

  function makeHandle(pathPrefix = ""): FileSystemDirectoryHandle {
    return {
      getDirectoryHandle: async (name: string) => {
        const next = pathPrefix ? `${pathPrefix}/${name}` : name;
        return makeHandle(next);
      },
      getFileHandle: async (name: string) => {
        const filePath = pathPrefix ? `${pathPrefix}/${name}` : name;
        return {
          createWritable: async () => {
            let payload = "";
            return {
              write: async (data: string) => {
                payload = data;
              },
              close: async () => {
                files.set(filePath, payload);
              },
            };
          },
        };
      },
    } as unknown as FileSystemDirectoryHandle;
  }

  return { root: makeHandle(), files };
}

describe("export-folder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects folder export support from showDirectoryPicker", () => {
    vi.stubGlobal("window", { isSecureContext: true, showDirectoryPicker: vi.fn() });
    expect(isFolderExportSupported()).toBe(true);
  });

  it("builds archive files for each document", () => {
    const files = buildExportArchiveFiles(docs, options);
    expect(files.some((file) => file.path === "manifest.json")).toBe(true);
    expect(files.some((file) => file.path === "corpus.json")).toBe(true);
    expect(files.some((file) => file.path === "plain-chunks.jsonl")).toBe(true);
    expect(files.filter((file) => file.path.startsWith("documents/"))).toHaveLength(2);
  });

  it("writes all archive files into a dated subfolder", async () => {
    const mock = createMockDirectory();
    vi.stubGlobal("window", {
      isSecureContext: true,
      showDirectoryPicker: vi.fn(async () => mock.root),
    });

    const result = await exportDocumentsToFolder(docs, options);
    expect(result.fileCount).toBe(docs.length + 3);
    expect(result.documentCount).toBe(2);
    expect(result.folderName).toMatch(/^mechsweep-\d{4}-\d{2}-\d{2}-2-docs$/);
    expect(mock.files.size).toBe(result.fileCount);
    expect(
      Array.from(mock.files.keys()).some((path) => path.endsWith("documents/001-pump-curves.txt"))
    ).toBe(true);

    const corpusRaw = mock.files.get(`${result.folderName}/corpus.json`);
    expect(corpusRaw).toBeTruthy();
    const corpus = JSON.parse(corpusRaw!) as { format: string; documents: { content: string }[] };
    expect(corpus.format).toBe("mechsweep-folder-v2");
    expect(corpus.documents.every((item) => item.content === "")).toBe(true);
  });

  it("uses wider document numbering for large libraries", () => {
    expect(buildDocumentExportPath(2937, 2938, "Large set")).toBe(
      "documents/2938-large-set.txt"
    );
  });
});
