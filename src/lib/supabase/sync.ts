import { applyDocumentBlob, extractDocumentBlob, readDocumentBlob } from "@/lib/document-blobs";
import { runWithConcurrency } from "@/lib/concurrency";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { removeDuplicateDocuments } from "@/lib/duplicates";
import { LIBRARY_BLOBS_BUCKET } from "@/lib/supabase/client";
import type { MechDocument } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const UPLOAD_CONCURRENCY = 5;
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

export async function uploadLibraryToSupabase(
  supabase: SupabaseClient,
  userId: string,
  docs: MechDocument[],
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<void> {
  const hydrated = await Promise.all(docs.map((doc) => hydrateDocumentForCloud(doc)));
  const localIds = new Set(hydrated.map((doc) => doc.id));

  const { data: remoteRows, error: listError } = await supabase
    .from("library_documents")
    .select("document_id")
    .eq("user_id", userId);

  if (listError) throw new Error(listError.message);

  const remoteIds = (remoteRows ?? []).map((row) => row.document_id as string);
  const staleIds = remoteIds.filter((id) => !localIds.has(id));

  if (staleIds.length > 0) {
    onProgress?.({ phase: "delete", completed: 0, total: staleIds.length });
    await supabase.from("library_documents").delete().eq("user_id", userId).in("document_id", staleIds);
    await supabase.storage.from(LIBRARY_BLOBS_BUCKET).remove(staleIds.map((id) => blobPath(userId, id)));
  }

  const indexRows = hydrated.map((doc) => toIndexRow(userId, doc));
  onProgress?.({ phase: "index", completed: 0, total: indexRows.length });

  for (let i = 0; i < indexRows.length; i += 200) {
    const batch = indexRows.slice(i, i + 200);
    const { error } = await supabase.from("library_documents").upsert(batch, {
      onConflict: "user_id,document_id",
    });
    if (error) throw new Error(error.message);
    onProgress?.({
      phase: "index",
      completed: Math.min(i + batch.length, indexRows.length),
      total: indexRows.length,
    });
  }

  let uploaded = 0;
  onProgress?.({ phase: "upload", completed: 0, total: hydrated.length });

  await runWithConcurrency(hydrated, UPLOAD_CONCURRENCY, async (doc) => {
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
    onProgress?.({ phase: "upload", completed: uploaded, total: hydrated.length });
  });
}

export async function downloadLibraryFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<MechDocument[]> {
  const { data: rows, error: listError } = await supabase
    .from("library_documents")
    .select("document_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (listError) throw new Error(listError.message);

  const ids = (rows ?? []).map((row) => row.document_id as string);
  if (ids.length === 0) return [];

  const documents: MechDocument[] = [];
  let completed = 0;
  onProgress?.({ phase: "download", completed: 0, total: ids.length });

  await runWithConcurrency(ids, UPLOAD_CONCURRENCY, async (documentId) => {
    const { data, error } = await supabase.storage
      .from(LIBRARY_BLOBS_BUCKET)
      .download(blobPath(userId, documentId));

    if (error) throw new Error(error.message);
    const text = await data.text();
    const doc = parseCloudPayload(text);
    if (doc) documents.push(doc);

    completed += 1;
    onProgress?.({ phase: "download", completed, total: ids.length });
  });

  return removeDuplicateDocuments(documents).slice(0, MAX_LIBRARY_DOCUMENTS);
}

export async function pullAndMergeLibrary(
  supabase: SupabaseClient,
  userId: string,
  localDocs: MechDocument[],
  onProgress?: (progress: CloudSyncProgress) => void
): Promise<MechDocument[]> {
  onProgress?.({ phase: "merge", completed: 0, total: 1 });
  const remoteDocs = await downloadLibraryFromSupabase(supabase, userId, onProgress);
  return mergeCloudLibraries(localDocs, remoteDocs);
}
