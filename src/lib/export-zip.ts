import { streamExportDocuments, type StreamExportProgress } from "@/lib/export-stream";
import { MemoryZipTarget, ZipStreamWriter } from "@/lib/zip-writer";
import type { ExportOptions, MechDocument } from "@/types";

export type ZipExportProgress = StreamExportProgress;

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

export function zipFilenameForExport(docCount: number): string {
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

/** Open the save dialog — call synchronously from a click handler before setState. */
export async function pickZipSaveLocation(docCount: number): Promise<FileSystemFileHandle> {
  if (!isStreamingZipSupported()) {
    throw new Error("Streaming ZIP export requires Chrome or Edge on HTTPS.");
  }

  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) {
    throw new Error("Streaming ZIP export is unavailable in this browser.");
  }

  return picker({
    suggestedName: zipFilenameForExport(docCount),
    types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
  });
}

async function writeArchiveToZip(
  writer: ZipStreamWriter,
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<void> {
  let chunksWriter: Awaited<ReturnType<ZipStreamWriter["openStreamingEntry"]>> | null = null;

  await streamExportDocuments(
    documents,
    options,
    {
      writeDocumentFile: (path, content) => writer.addStoredEntry(path, content),
      openChunkStream: async (path) => {
        chunksWriter = await writer.openStreamingEntry(path);
        return (line) => chunksWriter!.writeText(line);
      },
      closeChunkStream: async () => {
        if (chunksWriter) await chunksWriter.close();
      },
      writeMetadataFile: (path, content) => writer.addStoredEntry(path, content),
    },
    onProgress
  );
}

/** Write a ZIP to an already-chosen save file handle. */
export async function exportDocumentsToZipFile(
  handle: FileSystemFileHandle,
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<ZipExportResult> {
  if (documents.length === 0) {
    throw new Error("No documents to export.");
  }

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

/** Pick save location and stream a ZIP to disk. */
export async function exportDocumentsToZip(
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: ZipExportProgress) => void
): Promise<ZipExportResult> {
  const handle = await pickZipSaveLocation(documents.length);
  return exportDocumentsToZipFile(handle, documents, options, onProgress);
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
