import { del, get, list, put } from "@vercel/blob";
import { serializeForJsonResponse } from "@/lib/json-safe";
import { isValidLibraryId } from "@/lib/library-id";
import { prepareDocForCloud } from "@/lib/cloud-doc";
import type { MechDocument } from "@/types";

const DOC_PREFIX = "libraries";
const BLOB_PUT_OPTIONS = {
  access: "public" as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
};

export function isCloudStorageConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim()
  );
}

function docPath(libraryId: string, docId: string): string {
  return `${DOC_PREFIX}/${libraryId}/docs/${docId}.json`;
}

function manifestPath(libraryId: string): string {
  return `${DOC_PREFIX}/${libraryId}/manifest.json`;
}

async function readCloudDocument(blob: {
  pathname: string;
  url: string;
}): Promise<MechDocument | null> {
  try {
    const result = await get(blob.pathname, { access: "public" });
    if (result && result.statusCode === 200 && result.stream) {
      const raw = await new Response(result.stream).text();
      return JSON.parse(raw) as MechDocument;
    }
  } catch {
    // Fall back to public URL below.
  }

  try {
    const response = await fetch(blob.url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as MechDocument;
  } catch {
    return null;
  }
}

export async function listCloudDocuments(libraryId: string): Promise<MechDocument[]> {
  const prefix = `${DOC_PREFIX}/${libraryId}/docs/`;
  const { blobs } = await list({ prefix, limit: 10_000 });

  const documents = await Promise.all(blobs.map((blob) => readCloudDocument(blob)));
  return documents.filter((doc): doc is MechDocument => Boolean(doc?.id));
}

export async function upsertCloudDocument(libraryId: string, doc: MechDocument): Promise<void> {
  const payload = serializeForJsonResponse(prepareDocForCloud(doc));
  await put(docPath(libraryId, doc.id), payload, BLOB_PUT_OPTIONS);
}

export async function deleteCloudDocument(libraryId: string, docId: string): Promise<void> {
  await del(docPath(libraryId, docId));
}

async function writeManifest(libraryId: string, documentCount: number): Promise<void> {
  await put(
    manifestPath(libraryId),
    serializeForJsonResponse({
      updatedAt: new Date().toISOString(),
      documentCount,
    }),
    BLOB_PUT_OPTIONS
  );
}

export async function syncCloudDocuments(
  libraryId: string,
  documents: MechDocument[],
  deletedIds: string[] = []
): Promise<number> {
  for (const docId of deletedIds) {
    await deleteCloudDocument(libraryId, docId);
  }

  for (const doc of documents) {
    await upsertCloudDocument(libraryId, doc);
  }

  const remaining = await list({ prefix: `${DOC_PREFIX}/${libraryId}/docs/`, limit: 10_000 });
  await writeManifest(libraryId, remaining.blobs.length);

  return documents.length + deletedIds.length;
}

export function assertLibraryId(libraryId: string | null): string | null {
  if (!libraryId?.trim() || !isValidLibraryId(libraryId)) return null;
  return libraryId.trim();
}
