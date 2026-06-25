"use client";

import { useEffect, useState } from "react";
import SkipLink from "@/components/SkipLink";
import AppHeader from "@/components/AppHeader";
import CategoryInsights from "@/components/CategoryInsights";
import DocDrawer from "@/components/DocDrawer";
import DocLibrary from "@/components/DocLibrary";
import ExportModal from "@/components/ExportModal";
import SweepPanel from "@/components/SweepPanel";
import UploadZone from "@/components/UploadZone";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ChevronIcon, GlobeIcon, Spinner, UploadIcon } from "@/components/ui/Icons";
import { useDocumentLibrary } from "@/hooks/useDocumentLibrary";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import type { MeCategory } from "@/types";

type Tab = "sweep" | "upload";

const TAB_STORAGE_KEY = "mechsweep-tab";

const TABS: { id: Tab; label: string; icon: typeof GlobeIcon }[] = [
  { id: "sweep", label: "Web Sweep", icon: GlobeIcon },
  { id: "upload", label: "Upload", icon: UploadIcon },
];

function readStoredTab(): Tab {
  if (typeof window === "undefined") return "sweep";
  const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
  return saved === "upload" ? "upload" : "sweep";
}

export default function Home() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("sweep");
  const [tabReady, setTabReady] = useState(false);
  const [addExpanded, setAddExpanded] = useState(true);
  const [domainFilter, setDomainFilter] = useState<MeCategory | null>(null);
  const library = useDocumentLibrary({ filterEmptySweepErrors: true });

  useEffect(() => {
    setTab(readStoredTab());
    setTabReady(true);
  }, []);

  useEffect(() => {
    if (!tabReady) return;
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab, tabReady]);

  useEffect(() => {
    if (library.documents.length === 0) {
      setAddExpanded(true);
    }
  }, [library.documents.length]);

  function scrollToLibrary() {
    document.getElementById("main-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!library.hydrated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Spinner className="h-7 w-7 text-mech-600" aria-hidden="true" />
        <p className="text-sm text-slate-600">Loading your library…</p>
      </main>
    );
  }

  const hasLibrary = library.documents.length > 0;
  const layoutWidth = hasLibrary ? "max-w-6xl" : "max-w-3xl";

  return (
    <main className="min-h-screen bg-slate-50">
      <SkipLink />
      <AppHeader
        readyCount={library.readyCount}
        processingCount={library.processingCount}
        totalCount={library.documents.length}
        maxDocuments={MAX_LIBRARY_DOCUMENTS}
        maxWidth={hasLibrary ? "6xl" : "3xl"}
        documents={library.documents}
        onLibraryMerged={library.replaceLibrary}
        onExport={() => library.openExport(library.documents)}
        onClearAll={() => library.setShowClearConfirm(true)}
      />

      <div className={`mx-auto ${layoutWidth} px-4 py-6 sm:px-6`}>
        <section aria-label="Add documents">
          {hasLibrary && !addExpanded ? (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  {library.documents.length.toLocaleString()}
                </span>{" "}
                documents in your library
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={scrollToLibrary}
                  className="action-chip border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                >
                  Jump to library
                </button>
                <button
                  type="button"
                  onClick={() => setAddExpanded(true)}
                  className="action-chip bg-mech-600 text-white hover:bg-mech-700"
                >
                  Add more
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasLibrary && (
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">Add documents</h2>
                  <button
                    type="button"
                    onClick={() => setAddExpanded(false)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
                    aria-expanded={addExpanded}
                  >
                    Collapse
                    <ChevronIcon className="h-4 w-4 rotate-180" aria-hidden="true" />
                  </button>
                </div>
              )}

              <nav
                className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
                aria-label="Add documents"
              >
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={tab === id ? "page" : undefined}
                    className={`tab-button ${tab === id ? "tab-button-active" : "tab-button-inactive"}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </nav>

              <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
                {tab === "sweep" ? (
                  <SweepPanel
                    onAdd={library.addFromSweep}
                    addedUrls={library.addedUrls}
                    onAddedToLibrary={() => scrollToLibrary()}
                  />
                ) : (
                  <UploadZone
                    onUpload={async (files) => {
                      await library.addFromUpload(files);
                      scrollToLibrary();
                    }}
                  />
                )}
              </div>
            </>
          )}
        </section>

        <CategoryInsights
          documents={library.documents}
          selectedCategory={domainFilter}
          onCategorySelect={setDomainFilter}
        />

        <DocLibrary
          variant="home"
          documents={library.documents}
          domainFilter={domainFilter}
          onClearDomainFilter={() => setDomainFilter(null)}
          onRemove={library.requestRemoveDoc}
          onSelect={library.selectDoc}
          onRetry={library.retryDoc}
          onExport={(doc) => library.openExport([doc])}
          onBulkExport={library.openExport}
          onBulkDelete={library.requestBulkDelete}
          onBulkRetry={library.bulkRetry}
        />
      </div>

      {library.exportDocs && (
        <ExportModal
          documents={library.exportDocs}
          title={library.exportDocs.length === 1 ? "Export document" : "Export for RAG"}
          onClose={() => library.setExportDocs(null)}
          onExported={(detail) => {
            library.markDocumentsExported(detail.documentIds);
            const count = detail.documentIds.length;
            const suffix =
              detail.mode === "folder" && detail.fileCount
                ? ` (${detail.fileCount} files)`
                : "";
            toast(`Exported ${count} doc${count !== 1 ? "s" : ""}${suffix}`, "success");
          }}
        />
      )}

      <ConfirmDialog
        open={library.showClearConfirm}
        title="Clear all documents?"
        description={`Remove all ${library.documents.length} documents from your library. This cannot be undone.`}
        confirmLabel="Clear all"
        variant="danger"
        onConfirm={() => {
          library.clearAll();
          library.setShowClearConfirm(false);
          toast("Library cleared", "info");
        }}
        onCancel={() => library.setShowClearConfirm(false)}
      />

      <ConfirmDialog
        open={Boolean(library.pendingDeleteIds?.length)}
        title={
          (library.pendingDeleteIds?.length ?? 0) > 1
            ? `Delete ${library.pendingDeleteIds?.length} documents?`
            : "Delete document?"
        }
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={library.confirmDelete}
        onCancel={() => library.setPendingDeleteIds(null)}
      />

      <DocDrawer
        doc={library.selectedDoc}
        searchQuery={library.drawerSearchQuery}
        onClose={() => library.setSelectedDoc(null)}
        onRetry={library.retryDoc}
        onExport={(doc) => library.openExport([doc])}
      />
    </main>
  );
}
