"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import DocCard from "@/components/DocCard";
import LibraryStats from "@/components/LibraryStats";
import EmptyState from "@/components/ui/EmptyState";
import { GridIcon, Spinner } from "@/components/ui/Icons";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { normalizeCategory, buildDomainOptions, buildIndustryOptions, sortLabeledCounts, type FilterListSortMode } from "@/lib/category-stats";
import { DOC_TYPES, docTypeLabel } from "@/lib/file-types";
import type { DocSource, DocStatus, DocType, MeCategory, MechDocument } from "@/types";

interface DocLibraryProps {
  documents: MechDocument[];
  variant?: "home" | "libraries";
  onRemove: (id: string) => void;
  onSelect: (doc: MechDocument, searchQuery: string) => void;
  onRetry: (doc: MechDocument) => void;
  onExport?: (doc: MechDocument) => void;
  onBulkExport?: (docs: MechDocument[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkRetry?: (docs: MechDocument[]) => void;
  /** Filter library to a domain selected from the pie chart. */
  domainFilter?: MeCategory | null;
  onClearDomainFilter?: () => void;
  onDomainFilterChange?: (domain: MeCategory | null) => void;
}

type SortOption = "newest" | "oldest" | "title" | "type" | "domain" | "size";
type DateFilter = "all" | "7" | "30" | "365";
type SearchMode = "keyword" | "semantic";
type ExportedFilter = "all" | "exported" | "not-exported";

function documentSizeBytes(doc: MechDocument): number {
  return doc.sizeBytes ?? doc.contentLength ?? doc.content.length;
}

const PAGE_SIZE = 48;

function cosineSimilarity(a: number[] | undefined, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  if (!aMag || !bMag) return -1;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

export default function DocLibrary({
  documents,
  variant = "home",
  onRemove,
  onSelect,
  onRetry,
  onExport,
  onBulkExport,
  onBulkDelete,
  onBulkRetry,
  domainFilter = null,
  onClearDomainFilter,
  onDomainFilterChange,
}: DocLibraryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<DocSource | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [exportedFilter, setExportedFilter] = useState<ExportedFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [filterListSort, setFilterListSort] = useState<FilterListSortMode>("count-desc");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const q = deferredSearch.trim();
    if (searchMode !== "semantic" || !q) {
      setQueryEmbedding(null);
      setSemanticError(null);
      setSemanticLoading(false);
      return;
    }

    const controller = new AbortController();
    setSemanticLoading(true);
    const timeout = window.setTimeout(() => {
      void fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const data = (await res.json()) as { embedding?: number[]; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Semantic search failed");
          setQueryEmbedding(data.embedding ?? null);
          setSemanticError(null);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setQueryEmbedding(null);
          setSemanticError(err instanceof Error ? err.message : "Semantic search failed");
        })
        .finally(() => setSemanticLoading(false));
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      setSemanticLoading(false);
    };
  }, [deferredSearch, searchMode]);

  const industryOptions = useMemo(
    () => sortLabeledCounts(buildIndustryOptions(documents), filterListSort),
    [documents, filterListSort]
  );
  const domainOptions = useMemo(
    () => sortLabeledCounts(buildDomainOptions(documents), filterListSort),
    [documents, filterListSort]
  );
  const tags = useMemo(
    () => {
      const counts = new Map<string, number>();
      for (const doc of documents) {
        for (const tag of doc.tags ?? []) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
      return sortLabeledCounts(
        Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
        filterListSort
      );
    },
    [documents, filterListSort]
  );

  const docsWithoutEmbeddings = useMemo(
    () => documents.filter((doc) => doc.status === "ready" && !doc.embedding).length,
    [documents]
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const now = Date.now();
    const maxAgeMs =
      dateFilter === "all" ? null : Number(dateFilter) * 24 * 60 * 60 * 1000;

    return documents
      .filter((d) => {
        if (statusFilter !== "all" && d.status !== statusFilter) return false;
        if (typeFilter !== "all" && d.type !== typeFilter) return false;
        if (sourceFilter !== "all" && d.source !== sourceFilter) return false;
        if (categoryFilter !== "all" && d.category !== categoryFilter) {
          return false;
        }
        if (domainFilter && normalizeCategory(d.category) !== domainFilter) return false;
        if (tagFilter !== "all" && !(d.tags ?? []).includes(tagFilter)) return false;
        if (exportedFilter === "exported" && !d.exportedAt) return false;
        if (exportedFilter === "not-exported" && d.exportedAt) return false;
        if (maxAgeMs && now - new Date(d.addedAt).getTime() > maxAgeMs) return false;
        if (!q) return true;
        if (searchMode === "semantic") {
          if (semanticLoading || !queryEmbedding) return false;
          return Boolean(d.embedding);
        }
        const searchableText = [
          d.title,
          d.summary,
          d.category,
          d.url,
          d.content,
          ...(d.tags ?? []),
        ]
          .filter(Boolean)
          .join("\n")
          .toLowerCase();

        return searchableText.includes(q);
      })
      .sort((a, b) => {
        if (searchMode === "semantic" && queryEmbedding) {
          return cosineSimilarity(b.embedding, queryEmbedding) - cosineSimilarity(a.embedding, queryEmbedding);
        }
        if (sortBy === "oldest") {
          return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        }
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "type") return a.type.localeCompare(b.type);
        if (sortBy === "domain") {
          return normalizeCategory(a.category).localeCompare(normalizeCategory(b.category));
        }
        if (sortBy === "size") {
          return documentSizeBytes(b) - documentSizeBytes(a);
        }
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      });
  }, [
    documents,
    deferredSearch,
    statusFilter,
    typeFilter,
    sourceFilter,
    categoryFilter,
    domainFilter,
    tagFilter,
    dateFilter,
    exportedFilter,
    searchMode,
    queryEmbedding,
    semanticLoading,
    sortBy,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleDocs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstVisible = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastVisible = Math.min(page * PAGE_SIZE, filtered.length);
  const selectedDocs = documents.filter((doc) => selectedIds.has(doc.id));

  const hasActiveFilters =
    Boolean(deferredSearch.trim()) ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    sourceFilter !== "all" ||
    categoryFilter !== "all" ||
    tagFilter !== "all" ||
    dateFilter !== "all" ||
    exportedFilter !== "all" ||
    searchMode !== "keyword" ||
    Boolean(domainFilter);

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSourceFilter("all");
    setCategoryFilter("all");
    setTagFilter("all");
    setDateFilter("all");
    setExportedFilter("all");
    setSearchMode("keyword");
    onClearDomainFilter?.();
  }

  type FilterChip = { key: string; label: string; onClear: () => void };

  const activeFilterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    const q = deferredSearch.trim();
    if (q) chips.push({ key: "search", label: `Search: “${q}”`, onClear: () => setSearch("") });
    if (searchMode !== "keyword") {
      chips.push({
        key: "searchMode",
        label: "Semantic search",
        onClear: () => setSearchMode("keyword"),
      });
    }
    if (statusFilter !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter}`,
        onClear: () => setStatusFilter("all"),
      });
    }
    if (typeFilter !== "all") {
      chips.push({
        key: "type",
        label: `Type: ${docTypeLabel(typeFilter)}`,
        onClear: () => setTypeFilter("all"),
      });
    }
    if (sourceFilter !== "all") {
      chips.push({
        key: "source",
        label: `Source: ${sourceFilter}`,
        onClear: () => setSourceFilter("all"),
      });
    }
    if (categoryFilter !== "all") {
      chips.push({
        key: "category",
        label: `Industry: ${categoryFilter}`,
        onClear: () => setCategoryFilter("all"),
      });
    }
    if (domainFilter) {
      chips.push({
        key: "domain",
        label: `Domain: ${domainFilter}`,
        onClear: () => onClearDomainFilter?.(),
      });
    }
    if (tagFilter !== "all") {
      chips.push({ key: "tag", label: `Tag: ${tagFilter}`, onClear: () => setTagFilter("all") });
    }
    if (dateFilter !== "all") {
      const dateLabels: Record<DateFilter, string> = {
        all: "Any date",
        "7": "Last 7 days",
        "30": "Last 30 days",
        "365": "Last year",
      };
      chips.push({
        key: "date",
        label: dateLabels[dateFilter],
        onClear: () => setDateFilter("all"),
      });
    }
    if (exportedFilter !== "all") {
      chips.push({
        key: "exported",
        label: exportedFilter === "exported" ? "Exported only" : "Not exported",
        onClear: () => setExportedFilter("all"),
      });
    }
    return chips;
  }, [
    deferredSearch,
    searchMode,
    statusFilter,
    typeFilter,
    sourceFilter,
    categoryFilter,
    domainFilter,
    tagFilter,
    dateFilter,
    exportedFilter,
    onClearDomainFilter,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    typeFilter,
    sourceFilter,
    categoryFilter,
    tagFilter,
    dateFilter,
    exportedFilter,
    sortBy,
    searchMode,
    domainFilter,
  ]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(documents.map((doc) => doc.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [documents]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  function selectVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const doc of visibleDocs) next.add(doc.id);
      return next;
    });
    setSelectionMode(true);
  }

  if (documents.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white shadow-sm">
        <EmptyState
          icon={<GridIcon className="h-6 w-6" />}
          title="Your library is empty"
          description={
            variant === "libraries"
              ? "Go to the home page to sweep the web or upload local files."
              : "Documents you add from Web Sweep or Upload appear here — searchable, analyzable, and exportable for RAG."
          }
        />
      </div>
    );
  }

  return (
    <section className="mt-8 scroll-mt-24" id="main-content" aria-label="Document library">
      <LibraryStats documents={documents} />

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Library ({documents.length.toLocaleString()}
            {documents.length >= MAX_LIBRARY_DOCUMENTS * 0.9
              ? ` / ${MAX_LIBRARY_DOCUMENTS.toLocaleString()}`
              : ""}
            )
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Showing {firstVisible.toLocaleString()}-{lastVisible.toLocaleString()} of{" "}
            {filtered.length.toLocaleString()} matched documents. Search scans full document
            text.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectionMode((current) => !current);
              if (selectionMode) setSelectedIds(new Set());
            }}
            className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          >
            {selectionMode ? "Cancel selection" : "Select"}
          </button>
          <button
            type="button"
            onClick={selectVisible}
            className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          >
            Select page
          </button>
        </div>
      </div>

      {selectionMode && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-mech-200 bg-mech-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-mech-800">
            {selectedDocs.length} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onBulkExport?.(selectedDocs)}
              disabled={selectedDocs.length === 0 || !onBulkExport}
              className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => onBulkRetry?.(selectedDocs)}
              disabled={selectedDocs.length === 0 || !onBulkRetry}
              className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Re-analyze
            </button>
            <button
              type="button"
              onClick={() => {
                onBulkDelete?.(Array.from(selectedIds));
                clearSelection();
              }}
              disabled={selectedDocs.length === 0 || !onBulkDelete}
              className="action-chip border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="action-chip text-mech-800 hover:bg-white/60"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {documents.length >= MAX_LIBRARY_DOCUMENTS * 0.9 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {documents.length >= MAX_LIBRARY_DOCUMENTS
            ? `Library full (${MAX_LIBRARY_DOCUMENTS.toLocaleString()} documents). Remove documents to add more.`
            : `Approaching library limit — ${(MAX_LIBRARY_DOCUMENTS - documents.length).toLocaleString()} slots remaining.`}
        </p>
      )}

      {domainFilter && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-mech-200 bg-mech-50 px-3 py-2 text-sm text-mech-800">
          <span>
            Chart filter: <strong>{domainFilter}</strong>
          </span>
          <button
            type="button"
            onClick={onClearDomainFilter}
            className="action-chip border border-mech-200 bg-white text-mech-800 hover:bg-mech-100"
          >
            Clear
          </button>
        </div>
      )}

      {activeFilterChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Active filters:</span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              className="filter-chip"
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label}
              <span aria-hidden="true" className="ml-1 text-slate-500">
                ×
              </span>
            </button>
          ))}
          {activeFilterChips.length > 1 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-mech-700 hover:text-mech-900"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <fieldset className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <legend className="sr-only">Search and filter documents</legend>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <label htmlFor="library-search" className="filter-label">
              Search
            </label>
            <input
              id="library-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, content, summary, tags…"
              className="input-base"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="library-search-mode" className="filter-label">
              Search mode
            </label>
            <select
              id="library-search-mode"
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as SearchMode)}
              className="select-base"
            >
              <option value="keyword">Keyword</option>
              <option value="semantic">Semantic</option>
            </select>
          </div>
          <div>
            <label htmlFor="library-status" className="filter-label">
              Status
            </label>
            <select
              id="library-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DocStatus | "all")}
              className="select-base"
            >
              <option value="all">All status</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label htmlFor="library-sort" className="filter-label">
              Sort
            </label>
            <select
              id="library-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="select-base"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
              <option value="type">Type</option>
              <option value="domain">Domain</option>
              <option value="size">Size</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowMoreFilters((current) => !current)}
            className="text-sm font-semibold text-mech-700 hover:text-mech-900"
            aria-expanded={showMoreFilters}
            aria-controls="library-more-filters"
          >
            {showMoreFilters ? "Hide filters" : "More filters"}
            {!showMoreFilters && hasActiveFilters && (
              <span className="ml-1.5 rounded-full bg-mech-100 px-2 py-0.5 text-xs text-mech-800">
                active
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Reset filters
            </button>
          )}
        </div>

        {showMoreFilters && (
          <div id="library-more-filters" className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="library-type" className="filter-label">
              Type
            </label>
            <select
              id="library-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocType | "all")}
              className="select-base"
            >
              <option value="all">All types</option>
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {docTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-filter-sort" className="filter-label">
              List order
            </label>
            <select
              id="library-filter-sort"
              value={filterListSort}
              onChange={(e) => setFilterListSort(e.target.value as FilterListSortMode)}
              className="select-base"
            >
              <option value="count-desc">Count ↓</option>
              <option value="count-asc">Count ↑</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
            </select>
          </div>
          <div>
            <label htmlFor="library-domain" className="filter-label">
              Domain
            </label>
            <select
              id="library-domain"
              value={domainFilter ?? "all"}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "all") onDomainFilterChange?.(null);
                else onDomainFilterChange?.(value as MeCategory);
              }}
              className="select-base"
            >
              <option value="all">All domains</option>
              {domainOptions.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-category" className="filter-label">
              Industry
            </label>
            <select
              id="library-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select-base"
            >
              <option value="all">All industries</option>
              {industryOptions.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-source" className="filter-label">
              Source
            </label>
            <select
              id="library-source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as DocSource | "all")}
              className="select-base"
            >
              <option value="all">All sources</option>
              <option value="upload">Upload</option>
              <option value="sweep">Sweep</option>
            </select>
          </div>
          <div>
            <label htmlFor="library-date" className="filter-label">
              Date added
            </label>
            <select
              id="library-date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="select-base"
            >
              <option value="all">Any date</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
          <div>
            <label htmlFor="library-tag" className="filter-label">
              Tag
            </label>
            <select
              id="library-tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="select-base"
            >
              <option value="all">All tags</option>
              {tags.map((tag) => (
                <option key={tag.label} value={tag.label}>
                  {tag.label} ({tag.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-exported" className="filter-label">
              Export status
            </label>
            <select
              id="library-exported"
              value={exportedFilter}
              onChange={(e) => setExportedFilter(e.target.value as ExportedFilter)}
              className="select-base"
            >
              <option value="all">All documents</option>
              <option value="exported">Exported only</option>
              <option value="not-exported">Not exported</option>
            </select>
          </div>
          </div>
        )}
      </fieldset>

      {semanticLoading && deferredSearch.trim() && searchMode === "semantic" && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          <Spinner className="h-4 w-4" />
          Building semantic query…
        </p>
      )}

      {semanticError && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          Semantic search unavailable: {semanticError}
        </p>
      )}

      {docsWithoutEmbeddings > 0 && searchMode === "semantic" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {docsWithoutEmbeddings} ready document{docsWithoutEmbeddings !== 1 ? "s" : ""} lack
          embeddings — re-analyze or retry to enable semantic search.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {semanticLoading && deferredSearch.trim() && searchMode === "semantic"
              ? "Searching by meaning…"
              : "No documents match your filters."}
          </p>
          {hasActiveFilters && !semanticLoading && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="action-chip mt-4 border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleDocs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onRemove={onRemove}
                onSelect={() => onSelect(doc, deferredSearch)}
                onRetry={() => onRetry(doc)}
                onExport={onExport ? () => onExport(doc) : undefined}
                searchQuery={deferredSearch}
                selectionMode={selectionMode}
                selected={selectedIds.has(doc.id)}
                onToggleSelected={() => toggleSelected(doc.id)}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row">
              <p className="text-slate-500">
                Page {page} of {pageCount}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
