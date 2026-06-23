import { LOCAL_STORAGE_BACKUP_MAX_CHARS, MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { removeDuplicateDocuments } from "@/lib/duplicates";
import type { MechDocument } from "@/types";

const STORAGE_KEY = "mechsweep-documents";
const DB_NAME = "mechsweep";
const DB_VERSION = 2;
const LEGACY_STORE = "documents";
const LEGACY_RECORD_KEY = "all";
const LIBRARY_STORE = "library";

export class LibraryCapacityError extends Error {
  constructor(limit = MAX_LIBRARY_DOCUMENTS) {
    super(`Library limit reached (${limit} documents). Remove documents before adding more.`);
    this.name = "LibraryCapacityError";
  }
}

function normalizeDocuments(docs: MechDocument[]): MechDocument[] {
  return removeDuplicateDocuments(
    docs.filter((doc) => !(doc.source === "sweep" && doc.status === "error" && !doc.content))
  );
}

function trimToCapacity(docs: MechDocument[]): MechDocument[] {
  const normalized = normalizeDocuments(docs);
  if (normalized.length <= MAX_LIBRARY_DOCUMENTS) return normalized;
  return normalized.slice(0, MAX_LIBRARY_DOCUMENTS);
}

function pickRicherDocument(a: MechDocument, b: MechDocument): MechDocument {
  const rank = (doc: MechDocument) =>
    doc.status === "ready" ? 3 : doc.status === "processing" ? 2 : doc.status === "pending" ? 1 : 0;
  const rankA = rank(a);
  const rankB = rank(b);
  if (rankA !== rankB) return rankA > rankB ? a : b;
  const lenA = a.content?.length ?? 0;
  const lenB = b.content?.length ?? 0;
  if (lenA !== lenB) return lenA > lenB ? a : b;
  return a.addedAt >= b.addedAt ? a : b;
}

function librarySignature(docs: MechDocument[]): string {
  return docs
    .map(
      (doc) =>
        `${doc.id}:${doc.status}:${doc.content.length}:${doc.contentHash ?? ""}:${doc.addedAt}`
    )
    .join("|");
}

function mergePersistedLibraries(a: MechDocument[], b: MechDocument[]): MechDocument[] {
  const merged = new Map<string, MechDocument>();
  for (const doc of a) merged.set(doc.id, doc);
  for (const doc of b) {
    const existing = merged.get(doc.id);
    merged.set(doc.id, existing ? pickRicherDocument(existing, doc) : doc);
  }
  return trimToCapacity(Array.from(merged.values()));
}

function loadFromLocalStorage(): MechDocument[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MechDocument[];
    if (!Array.isArray(parsed)) return [];
    return trimToCapacity(parsed);
  } catch {
    return [];
  }
}

function maybeWriteLocalStorageBackup(docs: MechDocument[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const payload = JSON.stringify(trimToCapacity(docs));
    if (payload.length > LOCAL_STORAGE_BACKUP_MAX_CHARS) return;
    localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // IndexedDB remains the source of truth for large libraries.
  }
}

function saveToLocalStorage(docs: MechDocument[]): void {
  maybeWriteLocalStorageBackup(docs);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE)) {
        db.createObjectStore(LEGACY_STORE);
      }
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
        db.createObjectStore(LIBRARY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function readLegacyBlob(db: IDBDatabase): Promise<MechDocument[] | null> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(LEGACY_STORE)) {
      resolve(null);
      return;
    }

    const tx = db.transaction(LEGACY_STORE, "readonly");
    const request = tx.objectStore(LEGACY_STORE).get(LEGACY_RECORD_KEY);
    request.onsuccess = () => {
      const value = request.result;
      resolve(Array.isArray(value) ? normalizeDocuments(value as MechDocument[]) : null);
    };
    request.onerror = () => reject(request.error ?? new Error("Legacy IndexedDB read failed"));
  });
}

function readAllFromLibraryStore(db: IDBDatabase): Promise<MechDocument[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIBRARY_STORE, "readonly");
    const request = tx.objectStore(LIBRARY_STORE).getAll();
    request.onsuccess = () => {
      const docs = (request.result as MechDocument[]).filter((doc) => doc?.id);
      resolve(normalizeDocuments(docs));
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
}

async function migrateLegacyBlob(db: IDBDatabase): Promise<MechDocument[] | null> {
  const legacyDocs = await readLegacyBlob(db);
  if (!legacyDocs?.length) return null;

  await writeAllToLibraryStore(db, legacyDocs);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE, "readwrite");
    tx.objectStore(LEGACY_STORE).delete(LEGACY_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Legacy cleanup failed"));
  });

  return legacyDocs;
}

function writeAllToLibraryStore(db: IDBDatabase, docs: MechDocument[]): Promise<void> {
  const normalized = trimToCapacity(docs);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIBRARY_STORE, "readwrite");
    const store = tx.objectStore(LIBRARY_STORE);
    const keepIds = new Set(normalized.map((doc) => doc.id));

    const clearRequest = store.getAllKeys();
    clearRequest.onsuccess = () => {
      for (const key of clearRequest.result) {
        if (typeof key === "string" && !keepIds.has(key)) {
          store.delete(key);
        }
      }

      for (const doc of normalized) {
        store.put(doc);
      }
    };
    clearRequest.onerror = () => reject(clearRequest.error ?? new Error("IndexedDB key scan failed"));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}

export function isLibraryAtCapacity(count: number): boolean {
  return count >= MAX_LIBRARY_DOCUMENTS;
}

export function remainingLibraryCapacity(count: number): number {
  return Math.max(0, MAX_LIBRARY_DOCUMENTS - count);
}

/** Ask the browser not to evict this site's storage under memory pressure. */
export async function requestPersistentLibraryStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function loadDocuments(): Promise<MechDocument[]> {
  if (typeof window === "undefined") return [];

  const backupDocs = loadFromLocalStorage();

  try {
    const db = await openDatabase();
    let docs = await readAllFromLibraryStore(db);

    if (docs.length === 0) {
      const migrated = await migrateLegacyBlob(db);
      if (migrated?.length) docs = migrated;
    }

    if (docs.length === 0 && backupDocs.length > 0) {
      await writeAllToLibraryStore(db, backupDocs);
      docs = backupDocs;
    }

    db.close();

    const merged = mergePersistedLibraries(docs, backupDocs);
    if (librarySignature(merged) !== librarySignature(docs)) {
      await saveDocuments(merged);
    }

    return merged;
  } catch {
    return backupDocs;
  }
}

export async function saveDocuments(docs: MechDocument[]): Promise<void> {
  if (typeof window === "undefined") return;
  const normalized = trimToCapacity(docs);

  try {
    const db = await openDatabase();
    await writeAllToLibraryStore(db, normalized);
    db.close();
    maybeWriteLocalStorageBackup(normalized);
  } catch {
    saveToLocalStorage(normalized);
  }
}

/** Immediate persist — use on tab close and after critical updates. */
export async function flushDocuments(docs: MechDocument[]): Promise<void> {
  await saveDocuments(docs);
}

export async function upsertDocument(doc: MechDocument): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, "readwrite");
      tx.objectStore(LIBRARY_STORE).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB upsert failed"));
    });
    db.close();
  } catch {
    const existing = loadFromLocalStorage();
    const next = trimToCapacity([
      doc,
      ...existing.filter((item) => item.id !== doc.id),
    ]);
    saveToLocalStorage(next);
  }
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  if (typeof window === "undefined" || ids.length === 0) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, "readwrite");
      const store = tx.objectStore(LIBRARY_STORE);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    });
    db.close();
    const idSet = new Set(ids);
    maybeWriteLocalStorageBackup(loadFromLocalStorage().filter((doc) => !idSet.has(doc.id)));
  } catch {
    const idSet = new Set(ids);
    saveToLocalStorage(loadFromLocalStorage().filter((doc) => !idSet.has(doc.id)));
  }
}

export async function clearDocuments(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, "readwrite");
      tx.objectStore(LIBRARY_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
    });
    db.close();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    saveToLocalStorage([]);
  }
}
