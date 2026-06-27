import { hydrateDocumentForExport } from "@/lib/export-hydrate";
import {
  buildDocumentExportPath,
  buildExportChunksForDocument,
  buildExportManifest,
  buildFolderCorpusIndex,
  exportToTxt,
} from "@/lib/exporter";
import { MemoryZipTarget, ZipStreamWriter } from "@/lib/zip-writer";
import type { ExportOptions, MechDocument } from "@/types";

export interface ZipExportProgress {
  phase: "preparing" | "documents" | "metadata";
  completed: number;
  total: number;
}

export interface ZipExportResult {
  filename: string;
  fileCount: number;
  documentCount: number;
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
};

function zipFilename(docCount: number): string {
  const date = new Date().toISOString().slice(0, 10);
  return `mechsweep-${date}-${docCount}-docs.zip`;
}

export function isStreamingZipSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext &&
    typeof (window as SavePickerWindow).showSaveFilePicker === "function"
  );
}

async function writeArchiveToZip(
  writer: ZipStreamWriter,
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<{ exportPaths: string[]; chunkCount: number }> {
  const exportPaths: string[] = [];
  let chunkCount = 0;
  const chunksPath = `${options.preset}-chunks.jsonl`;
  const chunksWriter = await writer.openStreamingEntry(chunksPath);

  onProgress?.({ phase: "preparing", completed: 0, total: documents.length });

  for (let index = 0; index < documents.length; index++) {
    const hydrated = await hydrateDocumentForExport(documents[index]!);
    const exportPath = buildDocumentExportPath(index, documents.length, hydrated.title);
    exportPaths.push(exportPath);

    await writer.addStoredEntry(exportPath, exportToTxt([hydrated], options));

    for (const chunk of buildExportChunksForDocument(hydrated, options)) {
      await chunksWriter.writeText(`${JSON.stringify(chunk)}\n`);
      chunkCount += 1;
    }

    onProgress?.({ phase: "documents", completed: index + 1, total: documents.length });
  }

  await chunksWriter.close();

  onProgress?.({ phase: "metadata", completed: 0, total: 2 });

  const manifest = buildExportManifest(documents, options, chunkCount);
  await writer.addStoredEntry("manifest.json", JSON.stringify(manifest, null, 2));
  onProgress?.({ phase: "metadata", completed: 1, total: 2 });

  const corpus = buildFolderCorpusIndex(documents, options, exportPaths, chunkCount);
  await writer.addStoredEntry("corpus.json", JSON.stringify(corpus, null, 2));
  onProgress?.({ phase: "metadata", completed: 2, total: 2 });

  return { exportPaths, chunkCount };
}

/** Stream a ZIP to disk — scales to very large libraries (Chrome / Edge). */
export async function exportDocumentsToZip(
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<ZipExportResult> {
  if (!isStreamingZipSupported()) {
    throw new Error("Streaming ZIP export requires Chrome or Edge on HTTPS.");
  }

  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) {
    throw new Error("Streaming ZIP export is unavailable in this browser.");
  }

  if (documents.length === 0) {
    throw new Error("No documents to export.");
  }

  const handle = await picker({
    suggestedName: zipFilename(documents.length),
    types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
  });

  const writable = await handle.createWritable();
  const writer = new ZipStreamWriter({
    write: async (part) => {
      const chunk = new Uint8Array(part.byteLength);
      chunk.set(part);
      await writable.write(chunk);
    },
  });

  try {
    await writeArchiveToZip(writer, documents, options, onProgress);
    await writer.finalize();
    await writable.close();
  } catch (err) {
    try {
      await writable.abort();
    } catch {
      // ignore abort errors
    }
    throw err;
  }

  return {
    filename: handle.name,
    fileCount: documents.length + 3,
    documentCount: documents.length,
  };
}

/** Build a ZIP in memory one document at a time — for small libraries without save picker. */
export async function exportDocumentsToZipBuffer(
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<ArrayBuffer> {
  if (documents.length === 0) {
    throw new Error("No documents to export.");
  }

  const target = new MemoryZipTarget();
  const writer = new ZipStreamWriter(target);
  await writeArchiveToZip(writer, documents, options, onProgress);
  await writer.finalize();
  return target.toArrayBuffer();
}
