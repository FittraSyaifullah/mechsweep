"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

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
  const capacityLabel =
    maxDocuments && totalCount > 0
      ? `${totalCount.toLocaleString()} / ${maxDocuments.toLocaleString()} documents`
      : null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className={`mx-auto flex ${widthClass} items-center justify-between gap-4 px-4 py-4`}>
        <div>
          <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-mech-700">
            MechSweep
          </Link>
          <p className="text-xs text-slate-500">
            {processingCount > 0
              ? `${processingCount} processing · ${readyCount} ready`
              : totalCount > 0
                ? capacityLabel
                  ? `${capacityLabel} · ${readyCount} ready to export`
                  : `${readyCount} of ${totalCount} ready to export`
                : `Up to ${maxDocuments?.toLocaleString() ?? "5,000"} documents stored locally`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/libraries"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Libraries
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
            title={readyCount === 0 ? "Analyze documents first" : undefined}
          >
            Export{readyCount > 0 ? ` (${readyCount})` : ""}
          </Button>
        </div>
      </div>
    </header>
  );
}
