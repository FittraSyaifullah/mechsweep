"use client";

import type { MechDocument } from "@/types";

interface LibraryStatsProps {
  documents: MechDocument[];
}

export default function LibraryStats({ documents }: LibraryStatsProps) {
  const ready = documents.filter((d) => d.status === "ready").length;
  const processing = documents.filter((d) => d.status === "processing").length;
  const errors = documents.filter((d) => d.status === "error").length;
  const exported = documents.filter((d) => d.exportedAt).length;

  const items = [
    { label: "Ready", value: ready, tone: "text-emerald-800 bg-emerald-50 ring-emerald-200" },
    { label: "Processing", value: processing, tone: "text-sky-800 bg-sky-50 ring-sky-200" },
    { label: "Errors", value: errors, tone: "text-red-800 bg-red-50 ring-red-200" },
    { label: "Exported", value: exported, tone: "text-violet-800 bg-violet-50 ring-violet-200" },
  ];

  return (
    <div
      className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
      aria-label="Library summary"
    >
      {items.map(({ label, value, tone }) => (
        <div
          key={label}
          className={`rounded-lg px-3 py-2.5 ring-1 ${tone}`}
        >
          <p className="text-xs font-medium opacity-80">{label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
