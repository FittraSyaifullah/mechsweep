"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import DocDrawer from "@/components/DocDrawer";
import DocLibrary from "@/components/DocLibrary";
import ExportModal from "@/components/ExportModal";
import SweepPanel from "@/components/SweepPanel";
import UploadZone from "@/components/UploadZone";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Icons";
import { useDocumentLibrary } from "@/hooks/useDocumentLibrary";
import { useToast } from "@/components/Toast";

type Tab = "sweep" | "upload";

const TABS: { id: Tab; label: string }[] = [
  { id: "sweep", label: "Web Sweep" },
  { id: "upload", label: "Upload" },
];

export default function Home() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("sweep");
  const library = useDocumentLibrary({ filterEmptySweepErrors: true });

  if (!library.hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-6 w-6 text-mech-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader
        readyCount={library.readyCount}
        processingCount={library.processingCount}
        totalCount={library.documents.length}
        onExport={() => library.openExport(library.documents)}
        onClearAll={() => library.setShowClearConfirm(true)}
      />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex gap-6 border-b border-slate-200" aria-label="Main">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition ${
                tab === id
                  ? "border-mech-600 text-mech-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {tab === "sweep" ? (
            <SweepPanel onAdd={library.addFromSweep} addedUrls={library.addedUrls} />
          ) : (
            <UploadZone onUpload={library.addFromUpload} />
          )}
        </div>

        <DocLibrary
          variant="home"
          documents={library.documents}
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
        description={`Remove all ${library.documents.length} documents from your library.`}
        confirmLabel="Clear"
        variant="danger"
        onConfirm={() => {
          library.setDocuments([]);
          library.setSelectedDoc(null);
          library.setShowClearConfirm(false);
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
