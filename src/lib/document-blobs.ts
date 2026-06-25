import type { DocumentPage, ExtractedTable, MechDocument } from "@/types";

const BLOB_DIR = "library";
const MANIFEST_FILE = "_manifest.json";

export interface DocumentBlobPayload {
  content: string;
  pages?: DocumentPage[];
  tables?: ExtractedTable[];
  prefetchedText?: string;
  embedding?: number[];
}

interface DocumentBlobStore {
  write(id: string, payload: DocumentBlobPayload): Promise<void>;
  read(id: string): Promise<DocumentBlobPayload | null>;
  delete(id: string): Promise<void>;
  deleteExcept(keepIds: Set<string>): Promise<void>;
  clear(): Promise<void>;
}

let testStore: DocumentBlobStore | null = null;
let opfsProbeResult: boolean | null = null;
let opfsProbePromise: Promise<boolean> | null = null;

function hasOpfsApi(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

export function isOpfsSupported(): boolean {
  if (testStore) return true;
  if (opfsProbeResult !== null) return opfsProbeResult;
  return hasOpfsApi();
}

/** Probe OPFS read/write once (Chrome, Edge, etc.). Cached until reset. */
export async function probeOpfsSupport(force = false): Promise<boolean> {
  if (testStore) return true;
  if (!force && opfsProbeResult !== null) return opfsProbeResult;
  if (!force && opfsProbePromise) return opfsProbePromise;

  opfsProbePromise = (async () => {
    if (!hasOpfsApi()) {
      opfsProbeResult = false;
      return false;
    }

    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(BLOB_DIR, { create: true });
      const probeName = ".__probe";
      const handle = await dir.getFileHandle(probeName, { create: true });
      if (typeof handle.createWritable !== "function") {
        await dir.removeEntry(probeName).catch(() => undefined);
        opfsProbeResult = false;
        return false;
      }
      const writable = await handle.createWritable();
      await writable.write("ok");
      await writable.close();
      await dir.removeEntry(probeName).catch(() => undefined);
      opfsProbeResult = true;
      return true;
    } catch {
      opfsProbeResult = false;
      return false;
    } finally {
      opfsProbePromise = null;
    }
  })();

  return opfsProbePromise;
}

/** Test-only hook for in-memory blob storage. */
export function setDocumentBlobStoreForTests(store: DocumentBlobStore | null): void {
  testStore = store;
  opfsProbeResult = store ? true : null;
  opfsProbePromise = null;
}

/** Test-only reset of OPFS probe cache. */
export function resetOpfsProbeForTests(): void {
  if (testStore) return;
  opfsProbeResult = null;
  opfsProbePromise = null;
}

function blobFileName(id: string): string {
  return `${id}.json`;
}

function markOpfsUnavailable(): void {
  if (!testStore) opfsProbeResult = false;
}

function createOpfsStore(): DocumentBlobStore {
  async function libraryDir(create = false): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(BLOB_DIR, { create });
  }

  async function readManifest(dir: FileSystemDirectoryHandle): Promise<Set<string>> {
    try {
      const handle = await dir.getFileHandle(MANIFEST_FILE);
      const file = await handle.getFile();
      const parsed = JSON.parse(await file.text()) as { ids?: string[] };
      return new Set(Array.isArray(parsed.ids) ? parsed.ids : []);
    } catch {
      return new Set();
    }
  }

  async function writeManifest(dir: FileSystemDirectoryHandle, ids: Set<string>): Promise<void> {
    const handle = await dir.getFileHandle(MANIFEST_FILE, { create: true });
    if (typeof handle.createWritable !== "function") {
      throw new Error("OPFS createWritable is unavailable");
    }
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify({ ids: Array.from(ids) }));
    await writable.close();
  }

  async function writePayload(id: string, payload: DocumentBlobPayload): Promise<void> {
    const dir = await libraryDir(true);
    const handle = await dir.getFileHandle(blobFileName(id), { create: true });
    if (typeof handle.createWritable !== "function") {
      throw new Error("OPFS createWritable is unavailable");
    }
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(payload));
    await writable.close();
  }

  return {
    write: writePayload,
    async read(id) {
      try {
        const dir = await libraryDir(false);
        const handle = await dir.getFileHandle(blobFileName(id));
        const file = await handle.getFile();
        return JSON.parse(await file.text()) as DocumentBlobPayload;
      } catch {
        return null;
      }
    },
    async delete(id) {
      try {
        const dir = await libraryDir(false);
        await dir.removeEntry(blobFileName(id));
      } catch {
        // Missing blob is fine.
      }
    },
    async deleteExcept(keepIds) {
      try {
        const dir = await libraryDir(false);
        const manifest = await readManifest(dir);
        for (const id of Array.from(manifest)) {
          if (!keepIds.has(id)) {
            try {
              await dir.removeEntry(blobFileName(id));
            } catch {
              // Ignore per-file delete failures.
            }
          }
        }
        await writeManifest(
          dir,
          new Set(Array.from(manifest).filter((id) => keepIds.has(id)))
        );
      } catch {
        // Directory may not exist yet.
      }
    },
    async clear() {
      try {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(BLOB_DIR, { recursive: true });
      } catch {
        // Directory may not exist yet.
      }
    },
  };
}

function activeStore(): DocumentBlobStore | null {
  if (testStore) return testStore;
  if (!isOpfsSupported()) return null;
  return createOpfsStore();
}

export function documentHasBlobPayload(doc: MechDocument): boolean {
  return Boolean(
    doc.content ||
      doc.pages?.length ||
      doc.tables?.length ||
      doc.prefetchedText ||
      doc.embedding?.length
  );
}

export function extractDocumentBlob(doc: MechDocument): DocumentBlobPayload {
  return {
    content: doc.content,
    pages: doc.pages,
    tables: doc.tables,
    prefetchedText: doc.prefetchedText,
    embedding: doc.embedding,
  };
}

export function applyDocumentBlob(
  doc: MechDocument,
  blob: DocumentBlobPayload | null
): MechDocument {
  if (!blob) {
    return {
      ...doc,
      content: doc.content ?? "",
      contentLength: doc.contentLength ?? doc.content?.length ?? 0,
    };
  }

  return {
    ...doc,
    content: blob.content,
    pages: blob.pages,
    tables: blob.tables,
    prefetchedText: blob.prefetchedText,
    embedding: blob.embedding,
    contentLength: blob.content.length,
    blobStored: undefined,
  };
}

export async function writeDocumentBlob(
  id: string,
  payload: DocumentBlobPayload
): Promise<boolean> {
  const store = activeStore();
  if (!store) return false;
  try {
    await store.write(id, payload);
    return true;
  } catch {
    markOpfsUnavailable();
    return false;
  }
}

export async function readDocumentBlob(id: string): Promise<DocumentBlobPayload | null> {
  const store = activeStore();
  if (!store) return null;
  return store.read(id);
}

export async function deleteDocumentBlob(id: string): Promise<void> {
  const store = activeStore();
  if (!store) return;
  await store.delete(id);
}

async function writeManifestIds(ids: Set<string>): Promise<void> {
  if (testStore || !isOpfsSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(BLOB_DIR, { create: true });
    const handle = await dir.getFileHandle(MANIFEST_FILE, { create: true });
    if (typeof handle.createWritable !== "function") return;
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify({ ids: Array.from(ids) }));
    await writable.close();
  } catch {
    markOpfsUnavailable();
  }
}

/** Returns document ids whose blobs were stored successfully. */
export async function syncDocumentBlobs(
  docs: MechDocument[],
  keepIds: Set<string>
): Promise<Set<string>> {
  const store = activeStore();
  const storedIds = new Set<string>();
  if (!store) return storedIds;

  try {
    await store.deleteExcept(keepIds);
  } catch {
    markOpfsUnavailable();
    return storedIds;
  }

  await Promise.all(
    docs.map(async (doc) => {
      if (!documentHasBlobPayload(doc)) return;
      try {
        await store.write(doc.id, extractDocumentBlob(doc));
        storedIds.add(doc.id);
      } catch {
        markOpfsUnavailable();
      }
    })
  );

  await writeManifestIds(storedIds);
  return storedIds;
}

export async function clearDocumentBlobs(): Promise<void> {
  const store = activeStore();
  if (!store) return;
  await store.clear();
}

export async function hydrateDocumentsFromBlobs(
  docs: MechDocument[]
): Promise<MechDocument[]> {
  const store = activeStore();
  if (!store) return docs;

  return Promise.all(
    docs.map(async (doc) => {
      if (!doc.blobStored) return doc;
      const blob = await store.read(doc.id);
      return applyDocumentBlob(doc, blob);
    })
  );
}
