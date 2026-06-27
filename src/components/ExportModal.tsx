"use client";

import { useEffect, useState } from "react";
import type { ExportOptions, MechDocument } from "@/types";
import { MEMORY_ZIP_MAX_DOCUMENTS } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import {
  exportDocumentsToFolder,
  isFolderExportSupported,
  type FolderExportProgress,
} from "@/lib/export-folder";
import {
  exportDocumentsToZip,
  exportDocumentsToZipBuffer,
  isStreamingZipSupported,
  type ZipExportProgress,
} from "@/lib/export-zip";
import {
  downloadExport,
  exportToCsv,
  exportToJson,
  exportToPdf,
  exportToTxt,
} from "@/lib/exporter";
import Button from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/Icons";

interface ExportModalProps {
  documents: MechDocument[];
  onClose: () => void;
  onExported?: (detail: {
    mode: "download" | "folder";
    documentIds: string[];
    fileCount?: number;
  }) => void;
  title?: string;
}

type ExportProgress = FolderExportProgress | ZipExportProgress;

function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function progressLabel(progress: ExportProgress): string {
  if (progress.phase === "preparing") return "Preparing export…";
  if (progress.phase === "metadata") return "Writing manifest and index…";
  const pct =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return `Writing documents… ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} (${pct}%)`;
}

export default function ExportModal({
  documents,
  onClose,
  onExported,
  title = "Export for RAG",
}: ExportModalProps) {
  const { toast } = useToast();
  const [options, setOptions] = useState<ExportOptions>({
    format: "json",
    preset: "plain",
    chunkSize: 1000,
    chunkOverlap: 150,
    includeMetadata: true,
    includeContent: true,
    includeSummaries: true,
    includeTags: true,
  });
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const folderExportSupported = isFolderExportSupported();
  const streamingZipSupported = isStreamingZipSupported();

  const readyDocs = documents.filter((d) => d.status === "ready");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !exporting) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, exporting]);

  function buildDownloadPayload() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filenameBase =
      readyDocs.length === 1
        ? `mechsweep-${slugifyFilename(readyDocs[0].title) || "document"}-${timestamp}`
        : `mechsweep-${timestamp}`;

    const exporters: Record<
      Exclude<ExportOptions["format"], "zip">,
      { content: BlobPart; extension: string; mimeType: string }
    > = {
      txt: {
        content: exportToTxt(readyDocs, options),
        extension: "txt",
        mimeType: "text/plain",
      },
      json: {
        content: exportToJson(readyDocs, options),
        extension: "json",
        mimeType: "application/json",
      },
      csv: {
        content: exportToCsv(readyDocs, options),
        extension: "csv",
        mimeType: "text/csv",
      },
      pdf: {
        content: exportToPdf(readyDocs, options),
        extension: "pdf",
        mimeType: "application/pdf",
      },
    };

    return { filenameBase, selected: exporters[options.format as Exclude<ExportOptions["format"], "zip">] };
  }

  async function handleZipDownload() {
    if (readyDocs.length === 0 || exporting) return;

    setExporting(true);
    setExportProgress(null);

    try {
      if (streamingZipSupported) {
        const result = await exportDocumentsToZip(readyDocs, options, setExportProgress);
        onExported?.({
          mode: "download",
          documentIds: readyDocs.map((doc) => doc.id),
          fileCount: result.fileCount,
        });
        toast(
          `Saved ${result.documentCount.toLocaleString()} documents to ${result.filename}`,
          "success"
        );
        onClose();
        return;
      }

      if (readyDocs.length > MEMORY_ZIP_MAX_DOCUMENTS) {
        toast(
          `ZIP export for ${readyDocs.length.toLocaleString()} documents needs Chrome or Edge. Use Export to folder instead.`,
          "error"
        );
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `mechsweep-${timestamp}-${readyDocs.length}-docs.zip`;
      const buffer = await exportDocumentsToZipBuffer(readyDocs, options, setExportProgress);
      downloadExport(buffer, filename, "application/zip");
      onExported?.({
        mode: "download",
        documentIds: readyDocs.map((doc) => doc.id),
        fileCount: readyDocs.length + 3,
      });
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Could not export ZIP";
      toast(message, "error");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  async function handleDownload() {
    if (readyDocs.length === 0) return;

    if (options.format === "zip") {
      await handleZipDownload();
      return;
    }

    const { filenameBase, selected } = buildDownloadPayload();
    downloadExport(
      selected.content,
      `${filenameBase}.${selected.extension}`,
      selected.mimeType
    );
    onExported?.({ mode: "download", documentIds: readyDocs.map((doc) => doc.id) });
    onClose();
  }

  async function handleFolderExport() {
    if (readyDocs.length === 0 || exporting) return;
    setExporting(true);
    setExportProgress(null);
    try {
      const result = await exportDocumentsToFolder(readyDocs, options, setExportProgress);
      onExported?.({
        mode: "folder",
        documentIds: readyDocs.map((doc) => doc.id),
        fileCount: result.fileCount,
      });
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Could not export to folder";
      toast(message, "error");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  const zipUsesStreaming = options.format === "zip" && streamingZipSupported;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={exporting ? undefined : onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          {readyDocs.length} ready document{readyDocs.length !== 1 ? "s" : ""}
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {(["txt", "json", "csv", "pdf", "zip"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                disabled={exporting}
                onClick={() => setOptions((o) => ({ ...o, format: fmt }))}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium uppercase transition disabled:opacity-50 ${
                  options.format === fmt
                    ? "border-mech-500 bg-mech-50 text-mech-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              RAG preset
            </label>
            <select
              value={options.preset}
              disabled={exporting}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  preset: e.target.value as ExportOptions["preset"],
                }))
              }
              className="select-base mt-1 w-full"
            >
              <option value="plain">Plain corpus</option>
              <option value="langchain">LangChain</option>
              <option value="llamaindex">LlamaIndex</option>
              <option value="openai">OpenAI batch</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-slate-700">
              Chunk size
              <input
                type="number"
                min={200}
                max={8000}
                step={100}
                disabled={exporting}
                value={options.chunkSize}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    chunkSize: Math.max(200, Number(e.target.value) || 1000),
                  }))
                }
                className="input-base mt-1 w-full"
              />
            </label>
            <label className="text-sm text-slate-700">
              Overlap
              <input
                type="number"
                min={0}
                max={2000}
                step={50}
                disabled={exporting}
                value={options.chunkOverlap}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    chunkOverlap: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="input-base mt-1 w-full"
              />
            </label>
          </div>

          {(
            [
              ["includeMetadata", "Include metadata manifest"],
              ["includeContent", "Include content"],
              ["includeSummaries", "Include summaries"],
              ["includeTags", "Include tags"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={options[key]}
                disabled={exporting}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, [key]: e.target.checked }))
                }
                className="rounded border-slate-300 text-mech-600 focus:ring-mech-500"
              />
              {label}
            </label>
          ))}

          {options.format === "zip" ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {streamingZipSupported ? (
                <>
                  ZIP download streams one document at a time to disk — works for libraries of any
                  size. You&apos;ll pick where to save the file.
                </>
              ) : (
                <>
                  Large ZIP exports need Chrome or Edge. Up to{" "}
                  {MEMORY_ZIP_MAX_DOCUMENTS.toLocaleString()} documents can download in other
                  browsers, or use Export to folder.
                </>
              )}
            </p>
          ) : folderExportSupported ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Export to folder writes{" "}
              <span className="font-medium">manifest.json</span>,{" "}
              <span className="font-medium">corpus.json</span>, chunk files, and one text file per
              document under <span className="font-medium">documents/</span>.
            </p>
          ) : null}
        </div>

        {exportProgress && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-600 border-t-transparent"
              aria-hidden="true"
            />
            {progressLabel(exportProgress)}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          {folderExportSupported && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleFolderExport()}
              disabled={readyDocs.length === 0 || exporting}
            >
              {exporting && !zipUsesStreaming ? "Exporting…" : "Export to folder"}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void handleDownload()}
            disabled={readyDocs.length === 0 || exporting}
          >
            {exporting && (zipUsesStreaming || options.format === "zip")
              ? "Exporting ZIP…"
              : options.format === "zip"
                ? "Download ZIP"
                : "Download"}
          </Button>
        </div>
      </div>
    </div>
  );
}
