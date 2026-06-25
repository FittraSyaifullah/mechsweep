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
  pending: "text-amber-800",
  processing: "text-sky-800",
  ready: "text-emerald-800",
  error: "text-red-800",
};

const STATUS_BG: Record<MechDocument["status"], string> = {
  pending: "bg-amber-100 ring-amber-300",
  processing: "bg-sky-100 ring-sky-300",
  ready: "bg-emerald-100 ring-emerald-300",
  error: "bg-red-100 ring-red-300",
};

const TYPE_BG: Record<MechDocument["type"], string> = {
  pdf: "bg-red-100 text-red-900",
  txt: "bg-slate-200 text-slate-900",
  csv: "bg-emerald-100 text-emerald-900",
  json: "bg-amber-100 text-amber-900",
  md: "bg-indigo-100 text-indigo-900",
  zip: "bg-violet-100 text-violet-900",
  stl: "bg-cyan-100 text-cyan-900",
  step: "bg-sky-100 text-sky-900",
  dwg: "bg-orange-100 text-orange-900",
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

function contentLength(doc: MechDocument): number {
  return doc.content.length || doc.contentLength || 0;
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
  const titleId = `doc-title-${doc.id}`;

  const handleOpen = () => {
    if (selectionMode) onToggleSelected?.();
    else onSelect();
  };

  return (
    <article
      className={`flex min-h-[16rem] flex-col rounded-xl border bg-white p-4 shadow-sm motion-safe:transition motion-safe:hover:border-mech-400 motion-safe:hover:shadow-md ${
        selected ? "border-mech-500 ring-2 ring-mech-500/30" : "border-slate-300"
      }`}
      aria-labelledby={titleId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {selectionMode && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelected?.();
              }}
              className="h-4 w-4 rounded border-slate-400 text-mech-600 focus:ring-mech-500"
              aria-label={`Select ${doc.title}`}
            />
          )}
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${TYPE_BG[doc.type]}`}
          >
            {doc.type}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ${STATUS_BG[doc.status]} ${STATUS_COLOR[doc.status]}`}
            aria-label={`Status: ${statusLabel(doc)}`}
          >
            {isProcessing && <Spinner className="h-3 w-3" aria-hidden="true" />}
            {statusLabel(doc)}
          </span>
          {doc.exportedAt && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-300"
              aria-label={`Exported ${formatExportedAt(doc.exportedAt)}`}
            >
              <CheckIcon className="h-3 w-3" aria-hidden="true" />
              Exported
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(doc.id)}
          className="touch-target shrink-0 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
          aria-label={`Remove ${doc.title}`}
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="mt-4 flex min-h-[44px] flex-1 flex-col rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mech-500 focus-visible:ring-offset-2"
        aria-label={selectionMode ? `Select ${doc.title}` : `Open ${doc.title}`}
      >
        <h3
          id={titleId}
          className="line-clamp-3 text-base font-semibold leading-snug text-slate-900"
          title={doc.title}
        >
          <HighlightText text={doc.title} query={searchQuery} />
        </h3>

        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-600">
          {doc.category && (
            <>
              <HighlightText
                text={doc.category}
                query={searchQuery}
                className="max-w-full truncate font-medium"
              />
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="capitalize">{doc.source}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={doc.addedAt}>{formatDate(doc.addedAt)}</time>
        </div>

        {doc.summary && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-700">
            <HighlightText text={doc.summary} query={searchQuery} />
          </p>
        )}

        {doc.error && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-red-700" role="alert">
            {doc.error}
          </p>
        )}

        {!doc.summary && !doc.error && (
          <p className="mt-3 text-sm text-slate-600">
            {isProcessing ? "Preparing document…" : "Press Open to preview full content."}
          </p>
        )}

        {doc.tags && doc.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {doc.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-800"
              >
                <HighlightText text={tag} query={searchQuery} />
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span className="text-[11px] font-medium text-slate-600">
                +{doc.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </button>

      <footer className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
        <div className="flex min-w-0 flex-wrap gap-2">
          {doc.pageCount != null && <span>{doc.pageCount.toLocaleString()} pages</span>}
          {doc.rowCount != null && <span>{doc.rowCount.toLocaleString()} rows</span>}
          {doc.sizeBytes != null && <span>{formatBytes(doc.sizeBytes)}</span>}
          {doc.pageCount == null && doc.rowCount == null && doc.sizeBytes == null && (
            <span>{contentLength(doc).toLocaleString()} chars</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {doc.status === "error" ? (
            <button
              type="button"
              onClick={onRetry}
              className="action-chip bg-mech-50 text-mech-800 hover:bg-mech-100"
            >
              Retry
            </button>
          ) : (
            <>
              {canExport && (
                <button
                  type="button"
                  onClick={onExport}
                  className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                >
                  Export
                </button>
              )}
              <button
                type="button"
                onClick={handleOpen}
                className="action-chip bg-mech-600 text-white hover:bg-mech-700"
              >
                Open
              </button>
            </>
          )}
        </div>
      </footer>
    </article>
  );
}
