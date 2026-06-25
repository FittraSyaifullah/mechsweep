"use client";

import { useEffect, useState } from "react";
import type { MechDocument } from "@/types";
import HighlightText from "@/components/HighlightText";
import Button from "@/components/ui/Button";
import { CloseIcon, CheckIcon, Spinner } from "@/components/ui/Icons";

interface DocDrawerProps {
  doc: MechDocument | null;
  onClose: () => void;
  searchQuery?: string;
  onRetry?: (doc: MechDocument) => void;
  onExport?: (doc: MechDocument) => void;
}

function statusText(doc: MechDocument): string {
  if (doc.status === "processing") {
    return doc.source === "sweep" && !doc.content ? "Fetching…" : "Analyzing…";
  }
  return doc.status;
}

export default function DocDrawer({
  doc,
  onClose,
  searchQuery = "",
  onRetry,
  onExport,
}: DocDrawerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (doc) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [doc, onClose]);

  useEffect(() => {
    setCopied(false);
  }, [doc?.id]);

  if (!doc) return null;

  async function copyError() {
    if (!doc?.error) return;
    await navigator.clipboard.writeText(doc.error);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl animate-slide-left">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {doc.type} · {statusText(doc)}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              <HighlightText text={doc.title} query={searchQuery} />
            </h2>
            {doc.category && (
              <p className="mt-1 text-sm text-slate-600">
                <HighlightText text={doc.category} query={searchQuery} />
              </p>
            )}
            {doc.exportedAt && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
                <CheckIcon className="h-3.5 w-3.5" />
                Exported{" "}
                {new Intl.DateTimeFormat(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(doc.exportedAt))}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {doc.summary && (
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Summary
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                <HighlightText text={doc.summary} query={searchQuery} />
              </p>
            </section>
          )}

          {doc.keyTopics && doc.keyTopics.length > 0 && (
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Key topics
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {doc.keyTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-mech-50 px-2.5 py-0.5 text-xs text-mech-700"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </section>
          )}

          {doc.tags && doc.tags.length > 0 && (
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tags
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                  >
                    <HighlightText text={tag} query={searchQuery} />
                  </span>
                ))}
              </div>
            </section>
          )}

          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 inline-block text-sm text-mech-600 hover:underline"
            >
              View source →
            </a>
          )}

          <section className="mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Processing
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                Language: {doc.detectedLanguage ?? "Unknown"}
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                OCR: {doc.ocrStatus ?? "not_needed"}
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                Pages: {doc.pageCount ?? doc.pages?.length ?? 0}
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                Tables: {doc.tables?.length ?? 0}
              </div>
            </div>
            {doc.detectedUnits && doc.detectedUnits.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {doc.detectedUnits.map((unit) => (
                  <span
                    key={unit}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                  >
                    {unit}
                  </span>
                ))}
              </div>
            )}
          </section>

          {doc.tables && doc.tables.length > 0 && (
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tables
              </h3>
              {doc.tables.slice(0, 2).map((table) => (
                <div key={table.id} className="mt-2 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {table.headers.slice(0, 6).map((header) => (
                          <th key={header} className="px-2 py-1 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={`${table.id}-${rowIndex}`} className="border-t border-slate-100">
                          {row.slice(0, 6).map((cell, cellIndex) => (
                            <td key={`${table.id}-${rowIndex}-${cellIndex}`} className="px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          {doc.error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {doc.error}
            </div>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Content
            </h3>
            {doc.content ? (
              <pre className="mt-2 max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
                <HighlightText text={doc.content.slice(0, 5000)} query={searchQuery} />
                {doc.content.length > 5000 && "\n\n[… truncated …]"}
              </pre>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-slate-50 py-10 text-sm text-slate-500">
                <Spinner className="h-4 w-4 text-mech-600" />
                {statusText(doc)}
              </div>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4">
          {doc.status === "error" && onRetry && (
            <Button size="sm" onClick={() => onRetry(doc)}>
              Retry
            </Button>
          )}
          {doc.status === "ready" && onExport && (
            <Button size="sm" variant="secondary" onClick={() => onExport(doc)}>
              Export
            </Button>
          )}
          {doc.error && (
            <Button size="sm" variant="ghost" onClick={() => void copyError()}>
              {copied ? "Copied" : "Copy error"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </footer>
      </aside>
    </div>
  );
}
