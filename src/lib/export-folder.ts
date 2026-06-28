import { streamExportDocuments, type StreamExportProgress } from "@/lib/export-stream";
import type { ExportOptions, MechDocument } from "@/types";

export interface FolderExportResult {
  folderName: string;
  fileCount: number;
  documentCount: number;
}

export type FolderExportProgress = StreamExportProgress;

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

  const parentDir = await picker({ mode: "readwrite" });
  const folderName = exportFolderName(documents.length);
  const exportDir = await parentDir.getDirectoryHandle(folderName, { create: true });

  let chunksWritable: FileSystemWritableFileStream | null = null;

  await streamExportDocuments(
    documents,
    options,
    {
      writeDocumentFile: (path, content) => writeTextFile(exportDir, path, content),
      openChunkStream: async (path) => {
        chunksWritable = await openWritableFile(exportDir, path);
        return async (line) => {
          await chunksWritable!.write(line);
        };
      },
      closeChunkStream: async () => {
        if (chunksWritable) await chunksWritable.close();
      },
      writeMetadataFile: (path, content) => writeTextFile(exportDir, path, content),
    },
    onProgress
  );

  return {
    folderName,
    fileCount: documents.length + 3,
    documentCount: documents.length,
  };
}
