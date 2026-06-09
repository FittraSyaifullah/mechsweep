"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DocDrawer from "@/components/DocDrawer";
import DocLibrary from "@/components/DocLibrary";
import ExportModal from "@/components/ExportModal";
import { Spinner } from "@/components/ui/Icons";
import { useToast } from "@/components/Toast";
import {
  fetchDocumentContent,
  isUsableContent,
  normalizeImportedContent,
} from "@/lib/document-content";
import { loadDocuments, saveDocuments } from "@/lib/storage";
import type { AnalyzeResult, MechDocument } from "@/types";

const ANALYZE_CLIENT_CHARS = 4000;

export default function LibrariesPage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<MechDocument[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [exportDocs, setExportDocs] = useState<MechDocument[] | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<MechDocument | null>(null);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    void loadDocuments().then((docs) => {
      if (!active) return;
      setDocuments(docs);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveDocuments(documents);
  }, [documents, hydrated]);

  useEffect(() => {
    if (!selectedDoc) return;
    const updated = documents.find((doc) => doc.id === selectedDoc.id);
    setSelectedDoc(updated ?? null);
  }, [documents, selectedDoc]);

  function removeDoc(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    if (selectedDoc?.id === id) setSelectedDoc(null);
  }

  const embedDoc = useCallback(async (doc: MechDocument) => {
    try {
      const res = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${doc.title}\n\n${doc.content}` }),
      });
      const data = (await res.json()) as { embedding?: number[] };
      if (!res.ok || !data.embedding) return;
      setDocuments((prev) =>
        prev.map((item) => (item.id === doc.id ? { ...item, embedding: data.embedding } : item))
      );
    } catch {
      // Semantic search remains optional when embeddings fail.
    }
  }, []);

  const analyzeDoc = useCallback(
    async (doc: MechDocument) => {
      if (!doc.content) {
        toast(`No content to analyze: ${doc.title}`, "error");
        return;
      }

      setDocuments((prev) =>
        prev.map((item) =>
          item.id === doc.id ? { ...item, status: "processing" as const, error: undefined } : item
        )
      );

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: doc.content.slice(0, ANALYZE_CLIENT_CHARS),
            title: doc.title,
            type: doc.type,
          }),
        });
        const data = (await res.json()) as AnalyzeResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");

        setDocuments((prev) =>
          prev.map((item) =>
            item.id === doc.id
              ? {
                  ...item,
                  status: "ready" as const,
                  summary: data.summary,
                  tags: data.tags,
                  category: data.category,
                }
              : item
          )
        );
        void embedDoc(doc);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        setDocuments((prev) =>
          prev.map((item) =>
            item.id === doc.id ? { ...item, status: "error" as const, error: message } : item
          )
        );
      }
    },
    [embedDoc, toast]
  );

  function selectDoc(doc: MechDocument, searchQuery: string) {
    setSelectedDoc(doc);
    setDrawerSearchQuery(searchQuery);
  }

  function bulkDelete(ids: string[]) {
    const idSet = new Set(ids);
    setDocuments((prev) => prev.filter((doc) => !idSet.has(doc.id)));
    if (selectedDoc && idSet.has(selectedDoc.id)) setSelectedDoc(null);
    toast(`Deleted ${ids.length} doc${ids.length !== 1 ? "s" : ""}`, "info");
  }

  const retryDoc = useCallback(
    async (doc: MechDocument) => {
      if (doc.source === "sweep" && doc.url) {
        if (doc.content?.trim() && doc.status === "error") {
          void analyzeDoc(doc);
          return;
        }

        setDocuments((prev) =>
          prev.map((item) =>
            item.id === doc.id
              ? { ...item, status: "processing" as const, error: undefined, content: "" }
              : item
          )
        );

        try {
          const prefetched = doc.prefetchedText
            ? normalizeImportedContent(doc.prefetchedText)
            : "";
          let content = isUsableContent(prefetched) ? prefetched : "";
          let fetchData: Awaited<ReturnType<typeof fetchDocumentContent>> | null = null;

          if (!content) {
            fetchData = await fetchDocumentContent(doc.url, doc.type, doc.prefetchedText);
            content = fetchData.text;
          }

          const docType = fetchData?.type ?? doc.type;

          setDocuments((prev) =>
            prev.map((item) =>
              item.id === doc.id
                ? {
                    ...item,
                    type: docType,
                    content,
                    sizeBytes: fetchData?.sizeBytes ?? item.sizeBytes,
                    pageCount: fetchData?.pageCount ?? item.pageCount,
                    pages: fetchData?.pages ?? item.pages,
                    tables: fetchData?.tables ?? item.tables,
                    detectedLanguage: fetchData?.detectedLanguage ?? item.detectedLanguage,
                    detectedUnits: fetchData?.detectedUnits ?? item.detectedUnits,
                    ocrStatus: fetchData?.ocrStatus ?? item.ocrStatus,
                    rowCount: fetchData?.rowCount ?? item.rowCount,
                  }
                : item
            )
          );

          await analyzeDoc({ ...doc, content, type: docType });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Fetch failed";
          setDocuments((prev) =>
            prev.map((item) =>
              item.id === doc.id ? { ...item, status: "error" as const, error: message } : item
            )
          );
          toast(message.length > 120 ? `${message.slice(0, 117)}…` : message, "error");
        }
        return;
      }

      if (doc.content) void analyzeDoc(doc);
    },
    [analyzeDoc, toast]
  );

  function bulkRetry(docs: MechDocument[]) {
    for (const doc of docs) void retryDoc(doc);
    toast(`Retrying ${docs.length} doc${docs.length !== 1 ? "s" : ""}`, "info");
  }

  const readyCount = documents.filter((doc) => doc.status === "ready").length;
  const processingCount = documents.filter((doc) => doc.status === "processing").length;

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-6 w-6 text-mech-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader
        readyCount={readyCount}
        processingCount={processingCount}
        totalCount={documents.length}
        onExport={() => setExportDocs(documents)}
        onClearAll={() => setShowClearConfirm(true)}
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

        <DocLibrary
          documents={documents}
          onRemove={removeDoc}
          onSelect={selectDoc}
          onRetry={retryDoc}
          onExport={(doc) => setExportDocs([doc])}
          onBulkExport={setExportDocs}
          onBulkDelete={bulkDelete}
          onBulkRetry={bulkRetry}
        />
      </div>

      {exportDocs && (
        <ExportModal
          documents={exportDocs}
          title={exportDocs.length === 1 ? "Export document" : "Export for RAG"}
          onClose={() => setExportDocs(null)}
          onExported={() => {
            const count = exportDocs.filter((doc) => doc.status === "ready").length;
            toast(`Exported ${count} doc${count !== 1 ? "s" : ""}`, "success");
          }}
        />
      )}

      <ConfirmDialog
        open={showClearConfirm}
        title="Clear all documents?"
        description={`Remove all ${documents.length} documents from your library.`}
        confirmLabel="Clear"
        variant="danger"
        onConfirm={() => {
          setDocuments([]);
          setSelectedDoc(null);
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      <DocDrawer
        doc={selectedDoc}
        searchQuery={drawerSearchQuery}
        onClose={() => setSelectedDoc(null)}
      />
    </main>
  );
}
