"use client";

import { useMemo, useState } from "react";
import {
  buildCategoryBreakdown,
  countAnalyzedDocuments,
  type CategorySlice,
} from "@/lib/category-stats";
import { buildPieAngles, CATEGORY_COLORS, describePieSlice } from "@/lib/pie-chart";
import type { MeCategory, MechDocument } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import { GridIcon } from "@/components/ui/Icons";

interface CategoryPieChartProps {
  documents: MechDocument[];
  onCategorySelect?: (category: MeCategory | null) => void;
  selectedCategory?: MeCategory | null;
}

const SIZE = 220;
const RADIUS = 88;
const CENTER = SIZE / 2;

export default function CategoryPieChart({
  documents,
  onCategorySelect,
  selectedCategory = null,
}: CategoryPieChartProps) {
  const [hovered, setHovered] = useState<MeCategory | null>(null);
  const analyzedCount = countAnalyzedDocuments(documents);
  const slices = useMemo(() => buildCategoryBreakdown(documents), [documents]);
  const angles = useMemo(() => buildPieAngles(slices), [slices]);
  const activeCategory = hovered ?? selectedCategory;
  const activeSlice = slices.find((slice) => slice.category === activeCategory) ?? null;

  if (analyzedCount === 0) {
    return (
      <EmptyState
        icon={<GridIcon className="h-6 w-6" />}
        title="No analyzed documents yet"
        description="Documents appear here after analysis completes. Each is classified into a mechanical engineering domain."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
      <div className="mx-auto flex flex-col items-center">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Pie chart of documents by mechanical engineering domain"
          className="drop-shadow-sm"
        >
          {slices.map((slice, index) => {
            const { startAngle, endAngle } = angles[index];
            const isActive = activeCategory === slice.category;
            const dimmed = activeCategory !== null && !isActive;

            return (
              <path
                key={slice.category}
                d={describePieSlice(CENTER, CENTER, RADIUS, startAngle, endAngle)}
                fill={CATEGORY_COLORS[slice.category]}
                stroke="#ffffff"
                strokeWidth={2}
                opacity={dimmed ? 0.35 : 1}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHovered(slice.category)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  onCategorySelect?.(
                    selectedCategory === slice.category ? null : slice.category
                  )
                }
              >
                <title>
                  {slice.category}: {slice.count} ({slice.percentage.toFixed(0)}%)
                </title>
              </path>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r={42} fill="#ffffff" />
          <text
            x={CENTER}
            y={CENTER - 4}
            textAnchor="middle"
            className="fill-slate-900 text-[18px] font-semibold"
          >
            {analyzedCount}
          </text>
          <text
            x={CENTER}
            y={CENTER + 14}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
          >
            analyzed
          </text>
        </svg>
        {onCategorySelect && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Click a slice to filter the library
          </p>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <ul className="space-y-2">
          {slices.map((slice) => (
            <LegendRow
              key={slice.category}
              slice={slice}
              active={activeCategory === slice.category}
              selected={selectedCategory === slice.category}
              onHover={setHovered}
              onSelect={onCategorySelect}
            />
          ))}
        </ul>

        {activeSlice && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {activeSlice.category}
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm text-slate-700">
              {activeSlice.documents.slice(0, 8).map((doc) => (
                <li key={doc.id} className="truncate">
                  {doc.title}
                </li>
              ))}
              {activeSlice.documents.length > 8 && (
                <li className="text-xs text-slate-500">
                  +{activeSlice.documents.length - 8} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendRow({
  slice,
  active,
  selected,
  onHover,
  onSelect,
}: {
  slice: CategorySlice;
  active: boolean;
  selected: boolean;
  onHover: (category: MeCategory | null) => void;
  onSelect?: (category: MeCategory | null) => void;
}) {
  const clickable = Boolean(onSelect);

  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onMouseEnter={() => onHover(slice.category)}
        onMouseLeave={() => onHover(null)}
        onClick={() =>
          onSelect?.(selected ? null : slice.category)
        }
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
          active || selected ? "bg-mech-50 ring-1 ring-mech-200" : "hover:bg-slate-50"
        } ${clickable ? "cursor-pointer" : "cursor-default"}`}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[slice.category] }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{slice.category}</span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {slice.count} · {slice.percentage.toFixed(0)}%
        </span>
      </button>
    </li>
  );
}
