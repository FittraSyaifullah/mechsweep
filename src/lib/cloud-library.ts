import { fetchJson } from "@/lib/fetch-json";
import { prepareDocForCloud } from "@/lib/cloud-doc";
import { getLibraryId } from "@/lib/library-id";
import type { MechDocument } from "@/types";

export interface CloudLibraryResponse {
  documents: MechDocument[];
  cloudEnabled: boolean;
  updatedAt?: string;
}

export interface CloudSyncPayload {
  documents: MechDocument[];
  deletedIds?: string[];
}

const syncedDocKeys = new Map<string, string>();

function docSyncKey(doc: MechDocument): string {
  return [
    doc.id,
    doc.status,
    doc.addedAt,
    doc.contentHash ?? "",
    doc.content.length,
    doc.summary ?? "",
    doc.category ?? "",
    (doc.tags ?? []).join("|"),
  ].join(":");
}

export async function pullCloudDocuments(): Promise<CloudLibraryResponse> {
  const libraryId = getLibraryId();
  if (!libraryId) {
    return { documents: [], cloudEnabled: false };
  }

  const { data } = await fetchJson<CloudLibraryResponse>(
    `/api/library?libraryId=${encodeURIComponent(libraryId)}`
  );

  for (const doc of data.documents) {
    syncedDocKeys.set(doc.id, docSyncKey(doc));
  }

  return data;
}

export async function pushCloudDocuments(docs: MechDocument[]): Promise<boolean> {
  const libraryId = getLibraryId();
  if (!libraryId) return false;

  const currentIds = new Set(docs.map((doc) => doc.id));
  const changed = docs.filter((doc) => syncedDocKeys.get(doc.id) !== docSyncKey(doc));
  const deletedIds = Array.from(syncedDocKeys.keys()).filter((id) => !currentIds.has(id));

  if (changed.length === 0 && deletedIds.length === 0) return true;

  const payload: CloudSyncPayload = {
    documents: changed.map(prepareDocForCloud),
    deletedIds,
  };

  const { response, data } = await fetchJson<{ cloudEnabled?: boolean; synced?: number }>(
    `/api/library?libraryId=${encodeURIComponent(libraryId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) return false;

  for (const id of deletedIds) syncedDocKeys.delete(id);
  for (const doc of changed) syncedDocKeys.set(doc.id, docSyncKey(doc));

  return Boolean(data.cloudEnabled ?? true);
}

export function resetCloudSyncState(): void {
  syncedDocKeys.clear();
}
