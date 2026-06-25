"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/components/Toast";
import { buildLocalAnalyzeResult } from "@/lib/document-analysis";
import {
  combineFallbackSources,
  fetchDocumentContent,
  MIN_RECOVERY_CONTENT_CHARS,
  normalizeImportedContent,
  recoverContentFromSources,
  shouldSkipDirectFetch,
  type FetchedDocumentContent,
} from "@/lib/document-content";
import { fetchJson } from "@/lib/fetch-json";
import { LIBRARY_SAVE_DEBOUNCE_MS, MAX_LIBRARY_DOCUMENTS, ANALYZE_CONCURRENCY } from "@/lib/constants";
import { runWithConcurrency } from "@/lib/concurrency";
import {
  buildNormalizedUrlSet,
  dedupeSweepResultsByUrl,
  findDuplicateDocument,
  hashContent,
  normalizeDocumentUrl,
} from "@/lib/duplicates";
import {
  clearDocuments,
  deleteDocuments,
  flushDocuments,
  initBrowserStorage,
  isLibraryAtCapacity,
  loadDocuments,
  remainingLibraryCapacity,
  saveDocuments,
  upsertDocument,
} from "@/lib/storage";
import type { AnalyzeResult, MechDocument, SweepResult } from "@/types";
import type { UploadedFile } from "@/components/UploadZone";

const ANALYZE_CLIENT_CHARS = 4000;

interface UseDocumentLibraryOptions {
  filterEmptySweepErrors?: boolean;
  toastOnAnalyzeSuccess?: boolean;
}

export function useDocumentLibrary(options: UseDocumentLibraryOptions = {}) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<MechDocument[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [exportDocs, setExportDocs] = useState<MechDocument[] | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<MechDocument | null>(null);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hydrateResumeDoneRef = useRef(false);
  const documentsRef = useRef<MechDocument[]>([]);

  documentsRef.current = documents;

  useEffect(() => {
    let active = true;
    void initBrowserStorage();
    void loadDocuments()
      .then((docs) => {
        if (!active) return;
        const loaded = options.filterEmptySweepErrors
          ? docs.filter(
              (doc) => !(doc.source === "sweep" && doc.status === "error" && !doc.content)
            )
          : docs;
        setDocuments(loaded);
        setHydrated(true);
      })
      .catch(() => {
        if (!active) return;
        setDocuments([]);
        setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [options.filterEmptySweepErrors]);

  const applyReadyMetadata = useCallback(
    (id: string, data: AnalyzeResult, existingCategory?: string) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "ready" as const,
                error: undefined,
                summary: data.summary,
                tags: data.tags,
                category: data.category ?? existingCategory ?? d.category,
                keyTopics: data.keyTopics,
              }
            : d
        )
      );
    },
    []
  );

  useEffect(() => {
    if (!hydrated) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveDocuments(documentsRef.current);
    }, LIBRARY_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [documents, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const flush = () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void flushDocuments(documentsRef.current);
    };

    window.addEventListener("pagehide", flush);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!selectedDoc) return;
    const updated = documents.find((doc) => doc.id === selectedDoc.id);
    setSelectedDoc(updated ?? null);
  }, [documents, selectedDoc]);

  const addedUrls = useMemo(
    () => buildNormalizedUrlSet(documents.map((doc) => doc.url)),
    [documents]
  );

  const pendingAddUrlsRef = useRef<Set<string>>(new Set());

  const readyCount = documents.filter((d) => d.status === "ready").length;
  const processingCount = documents.filter((d) => d.status === "processing").length;

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
    async (id: string, content: string, title: string, type: string, categoryHint?: string) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: "processing" as const, error: undefined } : d
        )
      );

      const applyResult = (data: AnalyzeResult, usedFallback = false) => {
        applyReadyMetadata(id, data, categoryHint);
        if (options.toastOnAnalyzeSuccess !== false) {
          toast(
            usedFallback ? `"${title}" ready (basic metadata)` : `"${title}" ready`,
            usedFallback ? "info" : "success"
          );
        }
      };

      try {
        const { response: res, data } = await fetchJson<
          AnalyzeResult & { error?: string; fallback?: boolean }
        >("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.slice(0, ANALYZE_CLIENT_CHARS),
            title,
            type,
          }),
        });

        if (!res.ok) throw new Error(data.error ?? "Analysis failed");
        applyResult(data, Boolean(data.fallback));
      } catch (err) {
        if (content.trim().length >= MIN_RECOVERY_CONTENT_CHARS) {
          applyResult(
            buildLocalAnalyzeResult(title, type, content, categoryHint),
            true
          );
          return;
        }

        const message = err instanceof Error ? err.message : "Analysis failed";
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, status: "error" as const, error: message } : d
          )
        );
        toast(`Failed: ${title}`, "error");
      }
    },
    [applyReadyMetadata, options.toastOnAnalyzeSuccess, toast]
  );

  const analyzeAndEmbed = useCallback(
    async (
      id: string,
      content: string,
      title: string,
      type: string,
      categoryHint?: string
    ) => {
      await Promise.all([
        analyzeDoc(id, content, title, type, categoryHint),
        embedDoc(id, content, title),
      ]);
    },
    [analyzeDoc, embedDoc]
  );

  const fetchAndAnalyze = useCallback(
    async (
      id: string,
      result: Pick<SweepResult, "url" | "type" | "title" | "category" | "prefetchedText" | "description">
    ) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: "processing" as const, error: undefined, content: "" } : d
        )
      );

      const fallbackBundle = combineFallbackSources(
        result.prefetchedText,
        result.description,
        result.title
      );

      try {
        const prefetched = result.prefetchedText
          ? normalizeImportedContent(result.prefetchedText)
          : "";
        let fetchData: FetchedDocumentContent = { text: "" };
        let content = shouldSkipDirectFetch(result.url, prefetched) ? prefetched : "";

        if (!content) {
          fetchData = await fetchDocumentContent(
            result.url,
            result.type,
            fallbackBundle || undefined
          );
          content = fetchData.text;
        }

        const docType = fetchData.type ?? result.type;
        const contentHash = await hashContent(content);
        let skippedDuplicate = false;
        let persistedDoc: MechDocument | null = null;

        setDocuments((prev) => {
          const duplicate = findDuplicateDocument(
            prev.filter((doc) => doc.id !== id),
            { contentHash, url: result.url }
          );

          if (duplicate) {
            skippedDuplicate = true;
            toast(`Skipped duplicate: ${duplicate.title}`, "info");
            return prev.filter((doc) => doc.id !== id);
          }

          return prev.map((d) => {
            if (d.id !== id) return d;
            persistedDoc = {
              ...d,
              type: docType,
              content,
              contentHash,
              prefetchedText: result.prefetchedText,
              category: d.category ?? result.category,
              sizeBytes: fetchData.sizeBytes,
              pageCount: fetchData.pageCount,
              pages: fetchData.pages,
              tables: fetchData.tables,
              detectedLanguage: fetchData.detectedLanguage,
              detectedUnits: fetchData.detectedUnits,
              ocrStatus: fetchData.ocrStatus,
              rowCount: fetchData.rowCount,
            };
            return persistedDoc;
          });
        });

        if (skippedDuplicate) return;
        if (persistedDoc) void upsertDocument(persistedDoc);

        await analyzeAndEmbed(id, content, result.title, docType, result.category);
      } catch (err) {
        const recovered = recoverContentFromSources(
          result.prefetchedText,
          result.description,
          result.title
        );

        if (recovered) {
          const contentHash = await hashContent(recovered);
          let skippedDuplicate = false;

          setDocuments((prev) => {
            const duplicate = findDuplicateDocument(prev.filter((doc) => doc.id !== id), {
              contentHash,
              url: result.url,
              title: result.title,
            });
            if (duplicate) {
              skippedDuplicate = true;
              return prev.filter((doc) => doc.id !== id);
            }

            return prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    content: recovered,
                    contentHash,
                    prefetchedText: result.prefetchedText,
                    category: d.category ?? result.category,
                  }
                : d
            );
          });

          if (skippedDuplicate) {
            toast(`Skipped duplicate: ${result.title}`, "info");
            return;
          }

          await analyzeAndEmbed(id, recovered, result.title, result.type, result.category);
          toast(`Used cached preview for "${result.title}"`, "info");
          return;
        }

        if (result.title.trim()) {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    content: result.title,
                    prefetchedText: result.prefetchedText,
                    category: d.category ?? result.category,
                  }
                : d
            )
          );
          await analyzeAndEmbed(id, result.title, result.title, result.type, result.category);
          toast(`Saved "${result.title}" with title-only preview`, "info");
          return;
        }

        const message = err instanceof Error ? err.message : "Fetch failed";
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, status: "error" as const, error: message } : d
          )
        );
        toast(message.length > 120 ? `${message.slice(0, 117)}…` : message, "error");
      }
    },
    [analyzeAndEmbed, toast]
  );

  useEffect(() => {
    if (!hydrated || hydrateResumeDoneRef.current) return;
    hydrateResumeDoneRef.current = true;

    const pending = documents.filter((doc) => doc.status === "processing");
    if (pending.length === 0) return;

    void runWithConcurrency(pending, ANALYZE_CONCURRENCY, async (doc) => {
      if (doc.content?.trim()) {
        await analyzeAndEmbed(doc.id, doc.content, doc.title, doc.type, doc.category);
        return;
      }

      if (doc.source === "sweep" && doc.url) {
        await fetchAndAnalyze(doc.id, {
          url: doc.url,
          type: doc.type,
          title: doc.title,
          category: doc.category,
          prefetchedText: doc.prefetchedText,
          description: doc.summary ?? doc.title,
        });
      }
    });
  }, [hydrated, documents, analyzeAndEmbed, fetchAndAnalyze]);

  const addFromSweep = useCallback(
    async (result: SweepResult) => {
      const normalizedUrl = normalizeDocumentUrl(result.url) ?? result.url.trim();
      if (pendingAddUrlsRef.current.has(normalizedUrl)) {
        toast(`Already adding: ${result.title}`, "info");
        return;
      }

      pendingAddUrlsRef.current.add(normalizedUrl);
      const id = uuidv4();
      let skippedDuplicate = false;
      let skippedFull = false;

      try {
        let nextDocs: MechDocument[] | null = null;

        setDocuments((prev) => {
          if (isLibraryAtCapacity(prev.length)) {
            skippedFull = true;
            return prev;
          }

          const duplicate = findDuplicateDocument(prev, {
            url: normalizedUrl,
            title: result.title,
          });
          if (duplicate) {
            skippedDuplicate = true;
            return prev;
          }

          const newDoc: MechDocument = {
            id,
            title: result.title,
            type: result.type,
            source: "sweep",
            url: normalizedUrl,
            content: "",
            category: result.category,
            prefetchedText: result.prefetchedText,
            addedAt: new Date().toISOString(),
            status: "processing",
          };
          nextDocs = [newDoc, ...prev];
          return nextDocs;
        });

        if (skippedFull) {
          toast(`Library full (${MAX_LIBRARY_DOCUMENTS} documents). Remove some to add more.`, "error");
          return;
        }

        if (skippedDuplicate) {
          toast(`Already in library: ${result.title}`, "info");
          return;
        }

        if (nextDocs?.[0]) void upsertDocument(nextDocs[0]);

        await fetchAndAnalyze(id, { ...result, url: normalizedUrl });
      } finally {
        pendingAddUrlsRef.current.delete(normalizedUrl);
      }
    },
    [fetchAndAnalyze, toast]
  );

  const addFromUpload = useCallback(
    async (files: UploadedFile[]) => {
      const remaining = remainingLibraryCapacity(documents.length);
      if (remaining === 0) {
        toast(`Library full (${MAX_LIBRARY_DOCUMENTS} documents). Remove some to add more.`, "error");
        return;
      }

      const filesToProcess = files.slice(0, remaining);
      if (filesToProcess.length < files.length) {
        toast(`Only ${remaining} slot${remaining !== 1 ? "s" : ""} left — processing first ${remaining} file(s)`, "info");
      }

      const newDocs: MechDocument[] = [];
      const skipped: string[] = [];

      for (const file of filesToProcess) {
        if (!file.content.trim()) {
          skipped.push(file.title);
          continue;
        }

        const contentHash = await hashContent(file.content);
        const duplicate = findDuplicateDocument([...documents, ...newDocs], {
          contentHash,
          title: file.title,
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
        toast(
          skipped.length > 0 ? "Skipped empty or duplicate upload(s)" : "No files added",
          "info"
        );
        return;
      }

      setDocuments((prev) => {
        const next = [...newDocs, ...prev];
        void flushDocuments(next);
        return next;
      });
      toast(
        skipped.length > 0
          ? `Added ${newDocs.length}; skipped ${skipped.length} duplicate(s)`
          : `Added ${newDocs.length} file(s)`,
        "info"
      );

      await runWithConcurrency(newDocs, ANALYZE_CONCURRENCY, async (doc) => {
        await analyzeAndEmbed(doc.id, doc.content, doc.title, doc.type, doc.category);
      });
    },
    [analyzeAndEmbed, documents, toast]
  );

  const retryDoc = useCallback(
    async (doc: MechDocument) => {
      if (doc.source === "sweep" && doc.url) {
        if (doc.content?.trim() && doc.status === "error") {
          await analyzeAndEmbed(doc.id, doc.content, doc.title, doc.type);
          return;
        }

        await fetchAndAnalyze(doc.id, {
          url: doc.url,
          type: doc.type,
          title: doc.title,
          category: doc.category,
          prefetchedText: doc.prefetchedText,
          description: doc.summary ?? doc.title,
        });
        return;
      }

      if (doc.content) {
        await analyzeAndEmbed(doc.id, doc.content, doc.title, doc.type);
      }
    },
    [analyzeAndEmbed, fetchAndAnalyze]
  );

  function requestRemoveDoc(id: string) {
    setPendingDeleteIds([id]);
  }

  function requestBulkDelete(ids: string[]) {
    setPendingDeleteIds(ids);
  }

  function confirmDelete() {
    if (!pendingDeleteIds?.length) return;
    const ids = pendingDeleteIds;
    const idSet = new Set(ids);
    setDocuments((prev) => prev.filter((doc) => !idSet.has(doc.id)));
    if (selectedDoc && idSet.has(selectedDoc.id)) setSelectedDoc(null);
    void deleteDocuments(ids);
    toast(`Deleted ${ids.length} doc${ids.length !== 1 ? "s" : ""}`, "info");
    setPendingDeleteIds(null);
  }

  const clearAll = useCallback(() => {
    setDocuments([]);
    setSelectedDoc(null);
    void clearDocuments();
  }, []);

  function selectDoc(doc: MechDocument, searchQuery: string) {
    setSelectedDoc(doc);
    setDrawerSearchQuery(searchQuery);
  }

  function openExport(docs: MechDocument[]) {
    const ready = docs.filter((doc) => doc.status === "ready");
    if (ready.length === 0) {
      toast("No ready documents to export", "info");
      return;
    }
    if (ready.length < docs.length) {
      toast(`Exporting ${ready.length} of ${docs.length} (skipped processing/error docs)`, "info");
    }
    setExportDocs(ready);
  }

  const markDocumentsExported = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const exportedAt = new Date().toISOString();
    const idSet = new Set(ids);
    setDocuments((prev) => {
      const next = prev.map((doc) =>
        idSet.has(doc.id) ? { ...doc, exportedAt } : doc
      );
      void flushDocuments(next);
      return next;
    });
  }, []);

  function bulkRetry(docs: MechDocument[]) {
    for (const doc of docs) void retryDoc(doc);
    toast(`Retrying ${docs.length} doc${docs.length !== 1 ? "s" : ""}`, "info");
  }

  const replaceLibrary = useCallback((docs: MechDocument[]) => {
    setDocuments(docs);
    void flushDocuments(docs);
    toast(`Library updated (${docs.length.toLocaleString()} documents)`, "success");
  }, [toast]);

  return {
    documents,
    hydrated,
    exportDocs,
    setExportDocs,
    showClearConfirm,
    setShowClearConfirm,
    selectedDoc,
    setSelectedDoc,
    drawerSearchQuery,
    pendingDeleteIds,
    setPendingDeleteIds,
    addedUrls,
    readyCount,
    processingCount,
    libraryCapacity: MAX_LIBRARY_DOCUMENTS,
    remainingCapacity: remainingLibraryCapacity(documents.length),
    addFromSweep,
    addFromUpload,
    retryDoc,
    requestRemoveDoc,
    requestBulkDelete,
    confirmDelete,
    clearAll,
    selectDoc,
    openExport,
    markDocumentsExported,
    bulkRetry,
    replaceLibrary,
    setDocuments,
  };
}
