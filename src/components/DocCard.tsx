"use client";

import type { MechDocument } from "@/types";
import { formatBytes } from "@/lib/parser";
import HighlightText from "@/components/HighlightText";
import { CheckIcon, Spinner } from "@/components/ui/Icons";

interface DocCardProps {
  doc: MechDocument;
  onRemove: (id: string) => void;
  onSelect: () => void;
  onRetry: () => void;
  onExport?: () => void;
  searchQuery?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}

function statusLabel(doc: MechDocument): string {
  if (doc.status === "processing") {
    return doc.source === "sweep" && !doc.content ? "Fetching…" : "Analyzing…";
  }
  return doc.status;
}

const STATUS_COLOR: Record<MechDocument["status"], string> = {
  pending: "text-amber-600",
  processing: "text-sky-600",
  ready: "text-emerald-600",
  error: "text-red-600",
};

const STATUS_BG: Record<MechDocument["status"], string> = {
  pending: "bg-amber-50 ring-amber-100",
  processing: "bg-sky-50 ring-sky-100",
  ready: "bg-emerald-50 ring-emerald-100",
  error: "bg-red-50 ring-red-100",
};

const TYPE_BG: Record<MechDocument["type"], string> = {
  pdf: "bg-red-50 text-red-700",
  txt: "bg-slate-100 text-slate-700",
  csv: "bg-emerald-50 text-emerald-700",
  json: "bg-amber-50 text-amber-700",
  md: "bg-indigo-50 text-indigo-700",
  zip: "bg-violet-50 text-violet-700",
  stl: "bg-cyan-50 text-cyan-700",
  step: "bg-sky-50 text-sky-700",
  dwg: "bg-orange-50 text-orange-700",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatExportedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DocCard({
  doc,
  onRemove,
  onSelect,
  onRetry,
  onExport,
  searchQuery = "",
  selectionMode = false,
  selected = false,
  onToggleSelected,
}: DocCardProps) {
  const isProcessing = doc.status === "processing";
  const canExport = doc.status === "ready" && Boolean(onExport);
  const previewText =
    doc.content.trim() ||
    doc.summary ||
    doc.error ||
    (isProcessing ? "Document is still being prepared." : "No readable preview available.");
  const handleOpen = () => {
    if (selectionMode) onToggleSelected?.();
    else onSelect();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      className={`group relative flex min-h-[15rem] cursor-pointer flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-mech-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mech-500/30 ${
        selected ? "border-mech-400 ring-2 ring-mech-500/20" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {selectionMode && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelected?.();
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-slate-300 text-mech-600 focus:ring-mech-500"
              aria-label={`Select ${doc.title}`}
            />
          )}
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase ${TYPE_BG[doc.type]}`}
          >
            {doc.type}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${STATUS_BG[doc.status]} ${STATUS_COLOR[doc.status]}`}
          >
            {isProcessing && <Spinner className="h-3 w-3" />}
            {statusLabel(doc)}
          </span>
          {doc.exportedAt && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100"
              title={`Exported ${formatExportedAt(doc.exportedAt)}`}
            >
              <CheckIcon className="h-3 w-3" />
              Exported
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(doc.id);
          }}
          className="rounded-md px-1.5 py-0.5 text-lg leading-none text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Remove"
        >
          ×
        </button>
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">
          <HighlightText text={doc.title} query={searchQuery} />
        </h3>

        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
          {doc.category && (
            <HighlightText
              text={doc.category}
              query={searchQuery}
              className="max-w-full truncate"
            />
          )}
          {doc.category && <span>·</span>}
          <span className="capitalize">{doc.source}</span>
          <span>·</span>
          <span>{formatDate(doc.addedAt)}</span>
        </div>

        {doc.summary && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
            <HighlightText text={doc.summary} query={searchQuery} />
          </p>
        )}

        {doc.error && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-red-600">
            {doc.error}
          </p>
        )}

        {!doc.summary && !doc.error && (
          <p className="mt-3 text-sm text-slate-400">
            {isProcessing ? "Preparing document…" : "Click to preview content."}
          </p>
        )}

        {doc.tags && doc.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {doc.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
              >
                <HighlightText text={tag} query={searchQuery} />
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span className="text-[11px] text-slate-400">+{doc.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex min-w-0 gap-2">
          {doc.pageCount != null && <span>{doc.pageCount} pages</span>}
          {doc.rowCount != null && <span>{doc.rowCount} rows</span>}
          {doc.sizeBytes != null && <span>{formatBytes(doc.sizeBytes)}</span>}
          {doc.pageCount == null && doc.rowCount == null && doc.sizeBytes == null && (
            <span>{doc.content.length.toLocaleString()} chars</span>
          )}
        </div>

        {doc.status === "error" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="rounded px-2 py-1 text-xs font-medium text-mech-600 hover:bg-mech-50"
          >
            Retry
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {canExport && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport?.();
                }}
                className="font-medium text-slate-500 opacity-100 transition hover:text-mech-700 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                Export
              </button>
            )}
            <span className="font-medium text-mech-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:transition sm:group-hover:opacity-100">
              Open
            </span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute left-3 right-3 top-12 z-20 hidden rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl sm:group-hover:block">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
            File preview
          </p>
          <p className="shrink-0 text-[11px] text-slate-400">
            {doc.pageCount ? `${doc.pageCount} pages` : `${doc.content.length.toLocaleString()} chars`}
          </p>
        </div>
        <p className="max-h-40 overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
          <HighlightText text={previewText.slice(0, 900)} query={searchQuery} />
          {previewText.length > 900 && " …"}
        </p>
        {(doc.detectedUnits?.length || doc.tables?.length || doc.detectedLanguage) && (
          <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-500">
            {doc.detectedLanguage && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {doc.detectedLanguage}
              </span>
            )}
            {doc.tables && doc.tables.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                {doc.tables.length} table{doc.tables.length !== 1 ? "s" : ""}
              </span>
            )}
            {doc.detectedUnits?.slice(0, 4).map((unit) => (
              <span key={unit} className="rounded-full bg-slate-100 px-2 py-0.5">
                {unit}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
