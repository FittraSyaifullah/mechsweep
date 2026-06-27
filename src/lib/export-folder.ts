import { hydrateDocumentForExport } from "@/lib/export-hydrate";
import {
  buildDocumentExportPath,
  buildExportChunksForDocument,
  buildExportManifest,
  buildFolderCorpusIndex,
  exportToTxt,
} from "@/lib/exporter";
import type { ExportOptions, MechDocument } from "@/types";

export interface FolderExportResult {
  folderName: string;
  fileCount: number;
  documentCount: number;
}

export interface FolderExportProgress {
  phase: "preparing" | "documents" | "metadata";
  completed: number;
  total: number;
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

function exportFolderName(docCount: number): string {
  const date = new Date().toISOString().slice(0, 10);
  return `mechsweep-${date}-${docCount}-docs`;
}

export function isFolderExportSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function"
  );
}

async function getNestedDirectoryHandle(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  create: boolean
): Promise<FileSystemDirectoryHandle> {
  const segments = relativePath.split("/").filter(Boolean);
  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

async function openWritableFile(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<FileSystemWritableFileStream> {
  const segments = relativePath.split("/").filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) {
    throw new Error("Invalid export file path.");
  }

  const dir = await getNestedDirectoryHandle(
    root,
    segments.join("/"),
    segments.length > 0
  );
  const handle = await dir.getFileHandle(fileName, { create: true });
  if (typeof handle.createWritable !== "function") {
    throw new Error("Your browser cannot write files to the selected folder.");
  }
  return handle.createWritable();
}

async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string
): Promise<void> {
  const writable = await openWritableFile(root, relativePath);
  await writable.write(content);
  await writable.close();
}

/** Pick a folder and stream export files — scales to large libraries without loading all content at once. */
export async function exportDocumentsToFolder(
  documents: MechDocument[],
  options: ExportOptions,
  onProgress?: (progress: FolderExportProgress) => void
): Promise<FolderExportResult> {
  if (!isFolderExportSupported()) {
    throw new Error("Folder export requires Chrome or Edge on HTTPS.");
  }

  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Folder export is unavailable in this browser.");
  }

  if (documents.length === 0) {
    throw new Error("No documents to export.");
  }

  onProgress?.({ phase: "preparing", completed: 0, total: documents.length });

  const parentDir = await picker({ mode: "readwrite" });
  const folderName = exportFolderName(documents.length);
  const exportDir = await parentDir.getDirectoryHandle(folderName, { create: true });

  const exportPaths: string[] = [];
  let chunkCount = 0;
  const chunksPath = `${options.preset}-chunks.jsonl`;
  const chunksWritable = await openWritableFile(exportDir, chunksPath);

  for (let index = 0; index < documents.length; index++) {
    const hydrated = await hydrateDocumentForExport(documents[index]);
    const exportPath = buildDocumentExportPath(index, documents.length, hydrated.title);
    exportPaths.push(exportPath);

    await writeTextFile(exportDir, exportPath, exportToTxt([hydrated], options));

    for (const chunk of buildExportChunksForDocument(hydrated, options)) {
      await chunksWritable.write(`${JSON.stringify(chunk)}\n`);
      chunkCount += 1;
    }

    onProgress?.({ phase: "documents", completed: index + 1, total: documents.length });
  }

  await chunksWritable.close();

  onProgress?.({ phase: "metadata", completed: 0, total: 2 });

  const manifest = buildExportManifest(documents, options, chunkCount);
  await writeTextFile(exportDir, "manifest.json", JSON.stringify(manifest, null, 2));
  onProgress?.({ phase: "metadata", completed: 1, total: 2 });

  const corpus = buildFolderCorpusIndex(documents, options, exportPaths, chunkCount);
  await writeTextFile(exportDir, "corpus.json", JSON.stringify(corpus, null, 2));
  onProgress?.({ phase: "metadata", completed: 2, total: 2 });

  const fileCount = documents.length + 3;

  return {
    folderName,
    fileCount,
    documentCount: documents.length,
  };
}
