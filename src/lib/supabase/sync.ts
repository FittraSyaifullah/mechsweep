import { applyDocumentBlob, readDocumentBlob } from "@/lib/document-blobs";
import { runWithConcurrency } from "@/lib/concurrency";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { removeDuplicateDocuments } from "@/lib/duplicates";
import { LIBRARY_BLOBS_BUCKET } from "@/lib/supabase/client";
import type { MechDocument } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const UPLOAD_CONCURRENCY = 5;
const INDEX_BATCH_SIZE = 100;
const DELETE_BATCH_SIZE = 100;
const CLOUD_SYNC_VERSION = 1;

export interface LibraryDocumentIndexRow {
  user_id: string;
  document_id: string;
  title: string;
  status: string;
  content_hash: string | null;
  updated_at: string;
}

export interface CloudSyncProgress {
  phase: "index" | "upload" | "download" | "delete" | "merge";
  completed: number;
  total: number;
  skipped?: number;
}

export function isSupabaseSchemaMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("library_documents") ||
    message.includes("PGRST205") ||
    message.includes("schema cache")
  );
}

export function supabaseSchemaSetupMessage(): string {
  return "Cloud schema is not set up. Run supabase/migrations/001_library.sql in the Supabase SQL Editor, or run: node scripts/apply-supabase-migration.mjs";
}

interface CloudDocumentPayload {
  version: number;
  document: MechDocument;
}

function contentLengthOf(doc: MechDocument): number {
  return doc.contentLength ?? doc.content?.length ?? 0;
}

function pickRicherDocument(a: MechDocument, b: MechDocument): MechDocument {
  const rank = (doc: MechDocument) =>
    doc.status === "ready" ? 3 : doc.status === "processing" ? 2 : doc.status === "pending" ? 1 : 0;
  const rankA = rank(a);
  const rankB = rank(b);
  if (rankA !== rankB) return rankA > rankB ? a : b;
  const lenA = contentLengthOf(a);
  const lenB = contentLengthOf(b);
  if (lenA !== lenB) return lenA > lenB ? a : b;
  return a.addedAt >= b.addedAt ? a : b;
}

export function mergeCloudLibraries(local: MechDocument[], remote: MechDocument[]): MechDocument[] {
  const merged = new Map<string, MechDocument>();
  for (const doc of local) merged.set(doc.id, doc);
  for (const doc of remote) {
    const existing = merged.get(doc.id);
    merged.set(doc.id, existing ? pickRicherDocument(existing, doc) : doc);
  }
  const normalized = removeDuplicateDocuments(Array.from(merged.values()));
  return normalized.slice(0, MAX_LIBRARY_DOCUMENTS);
}

async function hydrateDocumentForCloud(doc: MechDocument): Promise<MechDocument> {
  if (doc.blobStored && !doc.content) {
    const blob = await readDocumentBlob(doc.id);
    if (blob) return applyDocumentBlob(doc, blob);
  }
  return doc;
}

function blobPath(userId: string, documentId: string): string {
  return `${userId}/${documentId}.json`;
}

function toIndexRow(userId: string, doc: MechDocument): LibraryDocumentIndexRow {
  return {
    user_id: userId,
    document_id: doc.id,
    title: doc.title,
    status: doc.status,
    content_hash: doc.contentHash ?? null,
    updated_at: new Date().toISOString(),
  };
}

function parseCloudPayload(raw: string): MechDocument | null {
  try {
    const parsed = JSON.parse(raw) as CloudDocumentPayload | MechDocument;
    if (parsed && typeof parsed === "object" && "document" in parsed) {
      return (parsed as CloudDocumentPayload).document;
    }
    return parsed as MechDocument;
  } catch {
    return null;
  }
}

async function fetchCloudIndexMap(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("library_documents")
      .select("document_id, content_hash")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    for (const row of rows) {
      map.set(row.document_id as string, (row.content_hash as string | null) ?? null);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return map;
}

async function deleteStaleCloudDocuments(
  supabase: SupabaseClient,
  userId: string,
  staleIds: string[],
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<void> {
  if (staleIds.length === 0) return;

  onProgress?.({ phase: "delete", completed: 0, total: staleIds.length });

  for (let i = 0; i < staleIds.length; i += DELETE_BATCH_SIZE) {
    const batch = staleIds.slice(i, i + DELETE_BATCH_SIZE);
    const { error: indexError } = await supabase
      .from("library_documents")
      .delete()
      .eq("user_id", userId)
      .in("document_id", batch);
    if (indexError) throw new Error(indexError.message);

    const { error: storageError } = await supabase.storage
      .from(LIBRARY_BLOBS_BUCKET)
      .remove(batch.map((id) => blobPath(userId, id)));
    if (storageError) throw new Error(storageError.message);

    onProgress?.({
      phase: "delete",
      completed: Math.min(i + batch.length, staleIds.length),
      total: staleIds.length,
    });
  }
}

export async function fetchCloudLibraryCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("library_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function uploadLibraryToSupabase(
  supabase: SupabaseClient,
  userId: string,
  docs: MechDocument[],
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<{ uploaded: number; skipped: number }> {
  const localIds = new Set(docs.map((doc) => doc.id));
  const remoteIndex = await fetchCloudIndexMap(supabase, userId);

  const staleIds = Array.from(remoteIndex.keys()).filter((id) => !localIds.has(id));
  await deleteStaleCloudDocuments(supabase, userId, staleIds, onProgress);

  let uploaded = 0;
  let skipped = 0;
  onProgress?.({ phase: "upload", completed: 0, total: docs.length, skipped: 0 });

  for (let offset = 0; offset < docs.length; offset += INDEX_BATCH_SIZE) {
    const batch = docs.slice(offset, offset + INDEX_BATCH_SIZE);
    const hydrated = await Promise.all(batch.map((doc) => hydrateDocumentForCloud(doc)));

    const { error: indexError } = await supabase.from("library_documents").upsert(
      hydrated.map((doc) => toIndexRow(userId, doc)),
      { onConflict: "user_id,document_id" }
    );
    if (indexError) throw new Error(indexError.message);

    onProgress?.({
      phase: "index",
      completed: Math.min(offset + batch.length, docs.length),
      total: docs.length,
      skipped,
    });

    await runWithConcurrency(hydrated, UPLOAD_CONCURRENCY, async (doc) => {
      const remoteHash = remoteIndex.get(doc.id) ?? null;
      const localHash = doc.contentHash ?? null;
      if (remoteHash && localHash && remoteHash === localHash) {
        skipped += 1;
        onProgress?.({
          phase: "upload",
          completed: uploaded + skipped,
          total: docs.length,
          skipped,
        });
        return;
      }

      const payload: CloudDocumentPayload = {
        version: CLOUD_SYNC_VERSION,
        document: {
          ...doc,
          blobStored: undefined,
          contentLength: contentLengthOf(doc),
        },
      };

      const { error } = await supabase.storage
        .from(LIBRARY_BLOBS_BUCKET)
        .upload(blobPath(userId, doc.id), JSON.stringify(payload), {
          upsert: true,
          contentType: "application/json",
        });

      if (error) throw new Error(error.message);
      uploaded += 1;
      onProgress?.({
        phase: "upload",
        completed: uploaded + skipped,
        total: docs.length,
        skipped,
      });
    });
  }

  return { uploaded, skipped };
}

export async function downloadLibraryFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  localDocs: MechDocument[] = [],
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<MechDocument[]> {
  const remoteIndex = await fetchCloudIndexMap(supabase, userId);
  const localById = new Map(localDocs.map((doc) => [doc.id, doc]));

  const unchanged = Array.from(remoteIndex.keys()).filter((documentId) => {
    const local = localById.get(documentId);
    if (!local) return false;
    const remoteHash = remoteIndex.get(documentId);
    const localHash = local.contentHash ?? null;
    return Boolean(remoteHash && localHash && remoteHash === localHash);
  });

  const toDownload = Array.from(remoteIndex.keys()).filter(
    (documentId) => !unchanged.includes(documentId)
  );

  if (toDownload.length === 0) {
    return removeDuplicateDocuments(localDocs).slice(0, MAX_LIBRARY_DOCUMENTS);
  }

  const documents: MechDocument[] = [];
  let completed = 0;
  const skipped = unchanged.length;
  onProgress?.({
    phase: "download",
    completed: skipped,
    total: remoteIndex.size,
    skipped,
  });

  await runWithConcurrency(toDownload, UPLOAD_CONCURRENCY, async (documentId) => {
    const { data, error } = await supabase.storage
      .from(LIBRARY_BLOBS_BUCKET)
      .download(blobPath(userId, documentId));

    if (error) throw new Error(error.message);
    const text = await data.text();
    const doc = parseCloudPayload(text);
    if (doc) documents.push(doc);

    completed += 1;
    onProgress?.({
      phase: "download",
      completed: skipped + completed,
      total: remoteIndex.size,
      skipped,
    });
  });

  const unchangedDocs = unchanged
    .map((id) => localById.get(id))
    .filter((doc): doc is MechDocument => Boolean(doc));

  return removeDuplicateDocuments([...unchangedDocs, ...documents]).slice(
    0,
    MAX_LIBRARY_DOCUMENTS
  );
}

export async function pullAndMergeLibrary(
  supabase: SupabaseClient,
  userId: string,
  localDocs: MechDocument[],
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<MechDocument[]> {
  onProgress?.({ phase: "merge", completed: 0, total: 1 });
  const remoteDocs = await downloadLibraryFromSupabase(
    supabase,
    userId,
    localDocs,
    onProgress
  );
  return mergeCloudLibraries(localDocs, remoteDocs);
}
