"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import AppHeader from "@/components/AppHeader";
import DocDrawer from "@/components/DocDrawer";
import DocLibrary from "@/components/DocLibrary";
import ExportModal from "@/components/ExportModal";
import SweepPanel from "@/components/SweepPanel";
import { useToast } from "@/components/Toast";
import UploadZone, { type UploadedFile } from "@/components/UploadZone";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Icons";
import { findDuplicateDocument, hashContent } from "@/lib/duplicates";
import { loadDocuments, saveDocuments } from "@/lib/storage";
import type { AnalyzeResult, MechDocument, SweepResult } from "@/types";

type Tab = "sweep" | "upload";

const TABS: { id: Tab; label: string }[] = [
  { id: "sweep", label: "Web Sweep" },
  { id: "upload", label: "Upload" },
];

const ANALYZE_CLIENT_CHARS = 4000;

export default function Home() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("sweep");
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
      setDocuments(
        docs.filter(
          (doc) => !(doc.source === "sweep" && doc.status === "error" && !doc.content)
        )
      );
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
    if (selectedDoc) {
      const updated = documents.find((d) => d.id === selectedDoc.id);
      if (updated) setSelectedDoc(updated);
    }
  }, [documents, selectedDoc]);

  const addedUrls = new Set(
    documents.filter((d) => d.url).map((d) => d.url as string)
  );

  const embedDoc = useCallback(async (id: string, content: string, title: string) => {
    try {
      const res = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${title}\n\n${content}` }),
      });
      const data = (await res.json()) as { embedding?: number[] };
      if (!res.ok || !data.embedding) return;
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, embedding: data.embedding } : doc))
      );
    } catch {
      // Semantic search remains optional when embeddings fail.
    }
  }, []);

  const analyzeDoc = useCallback(
    async (id: string, content: string, title: string, type: string) => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.slice(0, ANALYZE_CLIENT_CHARS),
            title,
            type,
          }),
        });
        const data = (await res.json()) as AnalyzeResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");

        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "ready" as const,
                  summary: data.summary,
                  tags: data.tags,
                  category: data.category,
                }
              : d
          )
        );
        toast(`"${title}" ready`, "success");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, status: "error" as const, error: message } : d
          )
        );
        toast(`Failed: ${title}`, "error");
      }
    },
    [toast]
  );

  const addFromUpload = useCallback(
    async (files: UploadedFile[]) => {
      const newDocs: MechDocument[] = [];
      const skipped: string[] = [];

      for (const file of files) {
        const contentHash = await hashContent(file.content);
        const duplicate = findDuplicateDocument([...documents, ...newDocs], {
          contentHash,
        });

        if (duplicate) {
          skipped.push(file.title);
          continue;
        }

        newDocs.push({
          id: uuidv4(),
          title: file.title,
          type: file.type,
          source: "upload",
          content: file.content,
          contentHash,
          pageCount: file.pageCount,
          pages: file.pages,
          tables: file.tables,
          detectedLanguage: file.detectedLanguage,
          detectedUnits: file.detectedUnits,
          ocrStatus: file.ocrStatus,
          rowCount: file.rowCount,
          sizeBytes: file.sizeBytes,
          addedAt: new Date().toISOString(),
          status: "processing",
        });
      }

      if (newDocs.length === 0) {
        toast("Skipped duplicate upload(s)", "info");
        return;
      }

      setDocuments((prev) => [...newDocs, ...prev]);
      toast(
        skipped.length > 0
          ? `Added ${newDocs.length}; skipped ${skipped.length} duplicate(s)`
          : `Added ${newDocs.length} file(s)`,
        "info"
      );

      for (const doc of newDocs) {
        void analyzeDoc(doc.id, doc.content, doc.title, doc.type);
        void embedDoc(doc.id, doc.content, doc.title);
      }
    },
    [analyzeDoc, documents, embedDoc, toast]
  );

  const fetchAndAnalyze = useCallback(
    async (
      id: string,
      result: Pick<SweepResult, "url" | "type" | "title" | "category" | "prefetchedText">
    ) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: "processing" as const, error: undefined, content: "" } : d
        )
      );

      try {
        let content = result.prefetchedText?.trim() ?? "";
        let fetchData: {
          type?: SweepResult["type"];
          sizeBytes?: number;
          pageCount?: number;
          pages?: MechDocument["pages"];
          tables?: MechDocument["tables"];
          detectedLanguage?: string;
          detectedUnits?: string[];
          ocrStatus?: MechDocument["ocrStatus"];
          rowCount?: number;
        } = {};

        if (!content) {
          const res = await fetch("/api/fetch-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: result.url, type: result.type }),
          });
          const data = (await res.json()) as {
            text?: string;
            type?: SweepResult["type"];
            sizeBytes?: number;
            pageCount?: number;
            pages?: MechDocument["pages"];
            tables?: MechDocument["tables"];
            detectedLanguage?: string;
            detectedUnits?: string[];
            ocrStatus?: MechDocument["ocrStatus"];
            rowCount?: number;
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? "Fetch failed");
          content = data.text ?? "";
          fetchData = data;
        }

        if (!content.trim()) {
          throw new Error("Fetched URL but no readable text was found");
        }

        const contentHash = await hashContent(content);
        const duplicate = findDuplicateDocument(
          documents.filter((doc) => doc.id !== id),
          { contentHash }
        );

        if (duplicate) {
          setDocuments((prev) => prev.filter((doc) => doc.id !== id));
          toast(`Skipped duplicate: ${duplicate.title}`, "info");
          return;
        }

        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  type: fetchData.type ?? d.type,
                  content,
                  contentHash,
                  prefetchedText: result.prefetchedText,
                  sizeBytes: fetchData.sizeBytes,
                  pageCount: fetchData.pageCount,
                  pages: fetchData.pages,
                  tables: fetchData.tables,
                  detectedLanguage: fetchData.detectedLanguage,
                  detectedUnits: fetchData.detectedUnits,
                  ocrStatus: fetchData.ocrStatus,
                  rowCount: fetchData.rowCount,
                }
              : d
          )
        );

        void analyzeDoc(id, content, result.title, result.type);
        void embedDoc(id, content, result.title);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fetch failed";
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, status: "error" as const, error: message } : d
          )
        );
        toast(message.length > 120 ? `${message.slice(0, 117)}…` : message, "error");
      }
    },
    [analyzeDoc, documents, embedDoc, toast]
  );

  const addFromSweep = useCallback(
    async (result: SweepResult) => {
      const duplicate = findDuplicateDocument(documents, { url: result.url });
      if (duplicate) {
        toast(`Already in library: ${duplicate.title}`, "info");
        return;
      }

      const id = uuidv4();
      setDocuments((prev) => [
        {
          id,
          title: result.title,
          type: result.type,
          source: "sweep",
          url: result.url,
          content: "",
          category: result.category,
          prefetchedText: result.prefetchedText,
          addedAt: new Date().toISOString(),
          status: "processing",
        },
        ...prev,
      ]);
      await fetchAndAnalyze(id, result);
    },
    [documents, fetchAndAnalyze, toast]
  );

  const retryDoc = useCallback(
    (doc: MechDocument) => {
      if (doc.source === "sweep" && doc.url) {
        void fetchAndAnalyze(doc.id, {
          url: doc.url,
          type: doc.type,
          title: doc.title,
          category: doc.category,
          prefetchedText: doc.prefetchedText,
        });
      } else if (doc.content) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, status: "processing" as const, error: undefined } : d
          )
        );
        void analyzeDoc(doc.id, doc.content, doc.title, doc.type);
      }
    },
    [analyzeDoc, fetchAndAnalyze]
  );

  function removeDoc(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedDoc?.id === id) setSelectedDoc(null);
  }

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

  function bulkRetry(docs: MechDocument[]) {
    for (const doc of docs) retryDoc(doc);
    toast(`Re-analyzing ${docs.length} doc${docs.length !== 1 ? "s" : ""}`, "info");
  }

  const readyCount = documents.filter((d) => d.status === "ready").length;
  const processingCount = documents.filter((d) => d.status === "processing").length;

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

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          {tab === "sweep" ? (
            <SweepPanel onAdd={addFromSweep} addedUrls={addedUrls} />
          ) : (
            <UploadZone onUpload={addFromUpload} />
          )}
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
