"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const onLibrariesPage = pathname === "/libraries";
  const widthClass = maxWidth === "6xl" ? "max-w-6xl" : "max-w-3xl";

  const statusLine = (() => {
    if (processingCount > 0) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-600" />
          </span>
          {processingCount.toLocaleString()} processing · {readyCount.toLocaleString()} ready
        </span>
      );
    }
    if (totalCount > 0) {
      const capacity =
        maxDocuments && totalCount > 0
          ? `${totalCount.toLocaleString()} / ${maxDocuments.toLocaleString()}`
          : `${totalCount.toLocaleString()}`;
      return `${capacity} documents · ${readyCount.toLocaleString()} ready to export`;
    }
    return `Store up to ${maxDocuments?.toLocaleString() ?? "25,000"} documents locally`;
  })();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-300 bg-white/95 backdrop-blur-sm">
      <div className={`mx-auto flex ${widthClass} items-center justify-between gap-4 px-4 py-3.5`}>
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="touch-target shrink-0 rounded-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mech-500 focus-visible:ring-offset-2"
            aria-label="MechSweep home"
          >
            <LogoMark className="h-9 w-9" />
          </Link>
          <div className="min-w-0">
            <Link
              href="/"
              className="text-base font-semibold text-slate-900 hover:text-mech-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mech-500 focus-visible:ring-offset-2 sm:text-lg"
            >
              MechSweep
            </Link>
            <p className="truncate text-xs font-medium text-slate-600" aria-live="polite">
              {statusLine}
            </p>
          </div>
        </div>

        <nav
          className="flex shrink-0 items-center gap-1 sm:gap-2"
          aria-label="Library actions"
        >
          <Link
            href="/libraries"
            aria-current={onLibrariesPage ? "page" : undefined}
            className={`touch-target rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mech-500 focus-visible:ring-offset-2 ${
              onLibrariesPage
                ? "bg-mech-50 text-mech-800"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Library
          </Link>
          {totalCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              aria-label={`Clear all ${totalCount.toLocaleString()} documents`}
            >
              Clear
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onExport}
            disabled={readyCount === 0}
            icon={<ExportIcon className="h-4 w-4" aria-hidden="true" />}
            aria-label={
              readyCount === 0
                ? "Export unavailable until documents are ready"
                : `Export ${readyCount.toLocaleString()} ready documents`
            }
          >
            <span className="hidden sm:inline">Export</span>
            {readyCount > 0 ? ` (${readyCount.toLocaleString()})` : ""}
          </Button>
        </nav>
      </div>
    </header>
  );
}
