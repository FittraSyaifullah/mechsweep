"use client";

import { useEffect, useState } from "react";
import type { ExportOptions, MechDocument } from "@/types";
import {
  downloadExport,
  exportToCsv,
  exportToJson,
  exportToPdf,
  exportToTxt,
  exportToZip,
} from "@/lib/exporter";
import Button from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/Icons";

interface ExportModalProps {
  documents: MechDocument[];
  onClose: () => void;
  onExported?: () => void;
  title?: string;
}

function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function ExportModal({
  documents,
  onClose,
  onExported,
  title = "Export for RAG",
}: ExportModalProps) {
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

  const readyDocs = documents.filter((d) => d.status === "ready");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function handleExport() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filenameBase =
      readyDocs.length === 1
        ? `mechsweep-${slugifyFilename(readyDocs[0].title) || "document"}-${timestamp}`
        : `mechsweep-${timestamp}`;

    const exporters: Record<
      ExportOptions["format"],
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
      zip: {
        content: exportToZip(readyDocs, options),
        extension: "zip",
        mimeType: "application/zip",
      },
    };
    const selected = exporters[options.format];
    downloadExport(
      selected.content,
      `${filenameBase}.${selected.extension}`,
      selected.mimeType
    );
    onExported?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
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
                onClick={() => setOptions((o) => ({ ...o, format: fmt }))}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium uppercase transition ${
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
                onChange={(e) =>
                  setOptions((o) => ({ ...o, [key]: e.target.checked }))
                }
                className="rounded border-slate-300 text-mech-600 focus:ring-mech-500"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={readyDocs.length === 0}>
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
