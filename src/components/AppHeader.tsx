"use client";

import Link from "next/link";
import LibrarySync from "@/components/LibrarySync";
import Button from "@/components/ui/Button";
import { ExportIcon, LogoMark } from "@/components/ui/Icons";

interface AppHeaderProps {
  readyCount: number;
  processingCount: number;
  totalCount: number;
  maxDocuments?: number;
  onExport: () => void;
  onClearAll: () => void;
  maxWidth?: "3xl" | "6xl";
}

export default function AppHeader({
  readyCount,
  processingCount,
  totalCount,
  maxDocuments,
  onExport,
  onClearAll,
  maxWidth = "3xl",
}: AppHeaderProps) {
  const widthClass = maxWidth === "6xl" ? "max-w-6xl" : "max-w-3xl";

  const statusLine = (() => {
    if (processingCount > 0) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
          </span>
          {processingCount} processing · {readyCount} ready
        </span>
      );
    }
    if (totalCount > 0) {
      const capacity =
        maxDocuments && totalCount > 0
          ? `${totalCount.toLocaleString()} / ${maxDocuments.toLocaleString()}`
          : `${totalCount.toLocaleString()}`;
      return `${capacity} documents · ${readyCount} ready to export`;
    }
    return `Store up to ${maxDocuments?.toLocaleString() ?? "10,000"} documents locally`;
  })();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className={`mx-auto flex ${widthClass} items-center justify-between gap-4 px-4 py-3.5`}>
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 rounded-lg transition hover:opacity-90">
            <LogoMark className="h-9 w-9" />
          </Link>
          <div className="min-w-0">
            <Link
              href="/"
              className="text-base font-semibold text-slate-900 hover:text-mech-700 sm:text-lg"
            >
              MechSweep
            </Link>
            <p className="truncate text-xs text-slate-500">{statusLine}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LibrarySync />
          <Link
            href="/libraries"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3 sm:text-sm"
          >
            Library
          </Link>
          {totalCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onExport}
            disabled={readyCount === 0}
            icon={<ExportIcon className="h-3.5 w-3.5" />}
            title={readyCount === 0 ? "Analyze documents first" : undefined}
          >
            <span className="hidden sm:inline">Export</span>
            {readyCount > 0 ? ` (${readyCount})` : ""}
          </Button>
        </div>
      </div>
    </header>
  );
}
