"use client";

import CategoryPieChart from "@/components/CategoryPieChart";
import { countAnalyzedDocuments } from "@/lib/category-stats";
import type { MeCategory, MechDocument } from "@/types";

interface CategoryInsightsProps {
  documents: MechDocument[];
  selectedCategory?: MeCategory | null;
  onCategorySelect?: (category: MeCategory | null) => void;
}

export default function CategoryInsights({
  documents,
  selectedCategory = null,
  onCategorySelect,
}: CategoryInsightsProps) {
  const analyzed = countAnalyzedDocuments(documents);
  const processing = documents.filter((doc) => doc.status === "processing").length;

  if (documents.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Domain breakdown</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Analyzed documents grouped by mechanical engineering category
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {analyzed} analyzed
          {processing > 0 ? ` · ${processing} still processing` : ""}
        </p>
      </div>

      <CategoryPieChart
        documents={documents}
        selectedCategory={selectedCategory}
        onCategorySelect={onCategorySelect}
      />
    </section>
  );
}
