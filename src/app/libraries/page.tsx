"use client";

import Link from "next/link";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import CategoryInsights from "@/components/CategoryInsights";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DocDrawer from "@/components/DocDrawer";
import DocLibrary from "@/components/DocLibrary";
import ExportModal from "@/components/ExportModal";
import { Spinner } from "@/components/ui/Icons";
import { useDocumentLibrary } from "@/hooks/useDocumentLibrary";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import type { MeCategory } from "@/types";

export default function LibrariesPage() {
  const { toast } = useToast();
  const [domainFilter, setDomainFilter] = useState<MeCategory | null>(null);
  const library = useDocumentLibrary({ toastOnAnalyzeSuccess: false });

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
        maxWidth="6xl"
        readyCount={library.readyCount}
        processingCount={library.processingCount}
        totalCount={library.documents.length}
        maxDocuments={MAX_LIBRARY_DOCUMENTS}
        onExport={() => library.openExport(library.documents)}
        onClearAll={() => library.setShowClearConfirm(true)}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Libraries</h1>
            <p className="text-sm text-slate-500">
              All documents stored locally in this browser.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Add documents
          </Link>
        </div>

        <CategoryInsights
          documents={library.documents}
          selectedCategory={domainFilter}
          onCategorySelect={setDomainFilter}
        />

        <DocLibrary
          variant="libraries"
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
        description={`Remove all ${library.documents.length} documents from your library.`}
        confirmLabel="Clear"
        variant="danger"
        onConfirm={() => {
          library.clearAll();
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
