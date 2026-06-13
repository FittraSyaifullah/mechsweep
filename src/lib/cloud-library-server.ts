import { del, list, put } from "@vercel/blob";
import { serializeForJsonResponse } from "@/lib/json-safe";
import { isValidLibraryId } from "@/lib/library-id";
import { prepareDocForCloud } from "@/lib/cloud-doc";
import type { MechDocument } from "@/types";

const DOC_PREFIX = "libraries";

export function isCloudStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function docPath(libraryId: string, docId: string): string {
  return `${DOC_PREFIX}/${libraryId}/docs/${docId}.json`;
}

function manifestPath(libraryId: string): string {
  return `${DOC_PREFIX}/${libraryId}/manifest.json`;
}

export async function listCloudDocuments(libraryId: string): Promise<MechDocument[]> {
  const prefix = `${DOC_PREFIX}/${libraryId}/docs/`;
  const { blobs } = await list({ prefix, limit: 10_000 });

  const documents = await Promise.all(
    blobs.map(async (blob) => {
      const response = await fetch(blob.url, { cache: "no-store" });
      if (!response.ok) return null;
      return (await response.json()) as MechDocument;
    })
  );

  return documents.filter((doc): doc is MechDocument => Boolean(doc?.id));
}

export async function syncCloudDocuments(
  libraryId: string,
  documents: MechDocument[],
  deletedIds: string[] = []
): Promise<number> {
  let synced = 0;

  for (const docId of deletedIds) {
    await del(docPath(libraryId, docId));
  }

  for (const doc of documents) {
    const payload = serializeForJsonResponse(prepareDocForCloud(doc));
    await put(docPath(libraryId, doc.id), payload, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    synced += 1;
  }

  const manifest = {
    updatedAt: new Date().toISOString(),
    documentCount: (await list({ prefix: `${DOC_PREFIX}/${libraryId}/docs/`, limit: 10_000 }))
      .blobs.length,
  };

  await put(manifestPath(libraryId), serializeForJsonResponse(manifest), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return synced;
}

export function assertLibraryId(libraryId: string | null): string | null {
  if (!libraryId?.trim() || !isValidLibraryId(libraryId)) return null;
  return libraryId.trim();
}
