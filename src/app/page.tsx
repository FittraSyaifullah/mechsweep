"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import CategoryInsights from "@/components/CategoryInsights";
import DocDrawer from "@/components/DocDrawer";
import DocLibrary from "@/components/DocLibrary";
import ExportModal from "@/components/ExportModal";
import SweepPanel from "@/components/SweepPanel";
import UploadZone from "@/components/UploadZone";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { GlobeIcon, Spinner, UploadIcon } from "@/components/ui/Icons";
import { useDocumentLibrary } from "@/hooks/useDocumentLibrary";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import type { MeCategory } from "@/types";

type Tab = "sweep" | "upload";

const TABS: { id: Tab; label: string; icon: typeof GlobeIcon }[] = [
  { id: "sweep", label: "Web Sweep", icon: GlobeIcon },
  { id: "upload", label: "Upload", icon: UploadIcon },
];

export default function Home() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("sweep");
  const [domainFilter, setDomainFilter] = useState<MeCategory | null>(null);
  const library = useDocumentLibrary({ filterEmptySweepErrors: true });

  if (!library.hydrated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Spinner className="h-7 w-7 text-mech-600" />
        <p className="text-sm text-slate-500">Loading your library…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader
        readyCount={library.readyCount}
        processingCount={library.processingCount}
        totalCount={library.documents.length}
        maxDocuments={MAX_LIBRARY_DOCUMENTS}
        onExport={() => library.openExport(library.documents)}
        onClearAll={() => library.setShowClearConfirm(true)}
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                tab === id
                  ? "bg-mech-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
          {tab === "sweep" ? (
            <SweepPanel onAdd={library.addFromSweep} addedUrls={library.addedUrls} />
          ) : (
            <UploadZone onUpload={library.addFromUpload} />
          )}
        </div>

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
          onExported={() => {
            const count = library.exportDocs?.length ?? 0;
            toast(`Exported ${count} doc${count !== 1 ? "s" : ""}`, "success");
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
