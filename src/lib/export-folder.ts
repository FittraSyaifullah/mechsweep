import { buildExportArchiveFiles } from "@/lib/exporter";
import type { ExportOptions, MechDocument } from "@/types";

export interface FolderExportResult {
  folderName: string;
  fileCount: number;
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

async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string
): Promise<void> {
  const segments = relativePath.split("/").filter(Boolean);
  const fileName = segments.pop();
  if (!fileName) return;

  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }

  const handle = await dir.getFileHandle(fileName, { create: true });
  if (typeof handle.createWritable !== "function") {
    throw new Error("Your browser cannot write files to the selected folder.");
  }
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Pick a folder and write all export files into a dated MechSweep subfolder. */
export async function exportDocumentsToFolder(
  documents: MechDocument[],
  options: ExportOptions
): Promise<FolderExportResult> {
  if (!isFolderExportSupported()) {
    throw new Error("Folder export requires Chrome or Edge on HTTPS.");
  }

  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("Folder export is unavailable in this browser.");
  }

  const parentDir = await picker({ mode: "readwrite" });
  const folderName = exportFolderName(documents.length);
  const exportDir = await parentDir.getDirectoryHandle(folderName, { create: true });
  const files = buildExportArchiveFiles(documents, options);

  for (const file of files) {
    await writeTextFile(exportDir, file.path, file.content);
  }

  return { folderName, fileCount: files.length };
}
