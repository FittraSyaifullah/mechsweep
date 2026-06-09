import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
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

function saveToLocalStorage(docs: MechDocument[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimToCapacity(docs)));
  } catch {
    // localStorage quota exceeded — IndexedDB is the primary store.
  }
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

export async function loadDocuments(): Promise<MechDocument[]> {
  if (typeof window === "undefined") return [];

  try {
    const db = await openDatabase();
    let docs = await readAllFromLibraryStore(db);

    if (docs.length === 0) {
      const migrated = await migrateLegacyBlob(db);
      if (migrated?.length) docs = migrated;
    }

    if (docs.length === 0) {
      const localDocs = loadFromLocalStorage();
      if (localDocs.length > 0) {
        await writeAllToLibraryStore(db, localDocs);
        docs = localDocs;
      }
    }

    db.close();
    return trimToCapacity(docs);
  } catch {
    return loadFromLocalStorage();
  }
}

export async function saveDocuments(docs: MechDocument[]): Promise<void> {
  if (typeof window === "undefined") return;
  const normalized = trimToCapacity(docs);

  try {
    const db = await openDatabase();
    await writeAllToLibraryStore(db, normalized);
    db.close();
  } catch {
    saveToLocalStorage(normalized);
  }
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
  } catch {
    const idSet = new Set(ids);
    saveToLocalStorage(loadFromLocalStorage().filter((doc) => !idSet.has(doc.id)));
  }
}
