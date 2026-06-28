"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  importDocumentsFromFileList,
  importDocumentsFromFolder,
  isFolderImportSupported,
  isFolderUploadSupported,
  type FolderImportDocument,
  type FolderImportProgress,
} from "@/lib/import-folder";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { FolderIcon, Spinner } from "@/components/ui/Icons";

interface ImportFolderZoneProps {
  onImport: (documents: FolderImportDocument[]) => void | Promise<void>;
}

function progressLabel(progress: FolderImportProgress): string {
  if (progress.phase === "scanning") return "Scanning export folder…";
  const pct =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return `Reading documents… ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} (${pct}%)`;
}

export default function ImportFolderZone({ onImport }: ImportFolderZoneProps) {
  const { toast } = useToast();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<FolderImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickerSupported = isFolderImportSupported();
  const uploadSupported = isFolderUploadSupported();

  async function finishImport(result: Awaited<ReturnType<typeof importDocumentsFromFolder>>) {
    if (result.documents.length === 0) {
      toast("No documents found in that folder", "info");
      return;
    }

    await onImport(result.documents);

    if (result.skippedFiles > 0) {
      toast(
        `Imported ${result.documents.length.toLocaleString()} documents; skipped ${result.skippedFiles.toLocaleString()} file(s)`,
        "info"
      );
    }
  }

  async function handlePickerImport() {
    if (importing) return;
    setImporting(true);
    setProgress(null);
    setError(null);

    try {
      const result = await importDocumentsFromFolder(setProgress);
      await finishImport(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Could not import folder";
      setError(message);
      toast(message, "error");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  async function handleFolderUpload(files: FileList) {
    if (importing || files.length === 0) return;
    setImporting(true);
    setProgress(null);
    setError(null);

    try {
      const result = await importDocumentsFromFileList(files, setProgress);
      await finishImport(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not import folder";
      setError(message);
      toast(message, "error");
    } finally {
      setImporting(false);
      setProgress(null);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  if (!uploadSupported) return null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Import export folder</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Restore a complete MechSweep export — the folder with{" "}
          <span className="font-medium">corpus.json</span>, chunk files, and{" "}
          <span className="font-medium">documents/</span>. Works with folder or ZIP exports saved
          and unzipped on disk.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {pickerSupported && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handlePickerImport()}
            disabled={importing}
            loading={importing && pickerSupported}
            icon={!importing ? <FolderIcon className="h-4 w-4" /> : undefined}
          >
            {importing ? "Importing…" : "Choose export folder"}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => !importing && folderInputRef.current?.click()}
          disabled={importing}
        >
          {pickerSupported ? "Or upload folder" : "Upload export folder"}
        </Button>
      </div>

      {!pickerSupported && (
        <p className="text-xs text-amber-800">
          For very large exports, use Chrome or Edge and choose the folder directly — it reads one
          file at a time instead of loading everything into memory.
        </p>
      )}

      {progress && (
        <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-sky-800">
            <Spinner className="h-3 w-3 shrink-0" />
            {progressLabel(progress)}
          </p>
          {progress.phase === "reading" && progress.total > 0 && (
            <ProgressBar value={progress.completed} max={progress.total} label="Import progress" />
          )}
        </div>
      )}

      {error && (
        <Alert variant="error" title="Import failed" detail={error} onRetry={() => setError(null)} retryLabel="Dismiss" />
      )}

      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is supported in Chromium and Firefox
        webkitdirectory=""
        directory=""
        multiple
        onChange={(e) => {
          if (e.target.files?.length) void handleFolderUpload(e.target.files);
        }}
        disabled={importing}
        className="hidden"
      />
    </div>
  );
}
