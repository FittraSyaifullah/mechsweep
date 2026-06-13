import { fetchJson } from "@/lib/fetch-json";
import { prepareDocForCloud } from "@/lib/cloud-doc";
import { getLibraryId } from "@/lib/library-id";
import { runWithConcurrency } from "@/lib/concurrency";
import { CLOUD_SYNC_CONCURRENCY } from "@/lib/constants";
import type { MechDocument } from "@/types";

export interface CloudLibraryResponse {
  documents: MechDocument[];
  cloudEnabled: boolean;
  updatedAt?: string;
}

export interface CloudSyncResult {
  ok: boolean;
  synced: number;
  failed: number;
  cloudEnabled: boolean;
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
    doc.error ?? "",
  ].join(":");
}

function libraryQuery(libraryId: string): string {
  return `/api/library?libraryId=${encodeURIComponent(libraryId)}`;
}

function documentQuery(libraryId: string, docId?: string): string {
  const base = `/api/library/document?libraryId=${encodeURIComponent(libraryId)}`;
  return docId ? `${base}&docId=${encodeURIComponent(docId)}` : base;
}

export async function pullCloudDocuments(): Promise<CloudLibraryResponse> {
  const libraryId = getLibraryId();
  if (!libraryId) {
    return { documents: [], cloudEnabled: false };
  }

  try {
    const { response, data } = await fetchJson<CloudLibraryResponse>(libraryQuery(libraryId));
    if (!response.ok) {
      return { documents: [], cloudEnabled: false };
    }

    syncedDocKeys.clear();
    for (const doc of data.documents) {
      syncedDocKeys.set(doc.id, docSyncKey(doc));
    }

    return data;
  } catch {
    return { documents: [], cloudEnabled: false };
  }
}

export async function pushCloudDocuments(docs: MechDocument[]): Promise<CloudSyncResult> {
  const libraryId = getLibraryId();
  if (!libraryId) {
    return { ok: false, synced: 0, failed: 0, cloudEnabled: false };
  }

  const currentIds = new Set(docs.map((doc) => doc.id));
  const changed = docs.filter((doc) => syncedDocKeys.get(doc.id) !== docSyncKey(doc));
  const deletedIds = Array.from(syncedDocKeys.keys()).filter((id) => !currentIds.has(id));

  if (changed.length === 0 && deletedIds.length === 0) {
    return { ok: true, synced: 0, failed: 0, cloudEnabled: true };
  }

  let synced = 0;
  let failed = 0;
  let cloudEnabled = true;

  await runWithConcurrency(changed, CLOUD_SYNC_CONCURRENCY, async (doc) => {
    try {
      const { response, data } = await fetchJson<{ cloudEnabled?: boolean; error?: string }>(
        documentQuery(libraryId),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prepareDocForCloud(doc)),
        }
      );

      if (!response.ok || data.cloudEnabled === false) {
        failed += 1;
        if (data.cloudEnabled === false) cloudEnabled = false;
        return;
      }

      syncedDocKeys.set(doc.id, docSyncKey(doc));
      synced += 1;
    } catch {
      failed += 1;
    }
  });

  for (const id of deletedIds) {
    try {
      const { response, data } = await fetchJson<{ cloudEnabled?: boolean }>(
        documentQuery(libraryId, id),
        { method: "DELETE" }
      );

      if (!response.ok || data.cloudEnabled === false) {
        failed += 1;
        if (data.cloudEnabled === false) cloudEnabled = false;
        continue;
      }

      syncedDocKeys.delete(id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    ok: failed === 0,
    synced,
    failed,
    cloudEnabled,
  };
}

export function resetCloudSyncState(): void {
  syncedDocKeys.clear();
}

export async function checkCloudSyncAvailable(): Promise<boolean> {
  const libraryId = getLibraryId();
  if (!libraryId) return false;

  try {
    const { data } = await fetchJson<CloudLibraryResponse>(libraryQuery(libraryId));
    return Boolean(data.cloudEnabled);
  } catch {
    return false;
  }
}
