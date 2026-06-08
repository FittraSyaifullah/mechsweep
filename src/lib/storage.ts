import type { MechDocument } from "@/types";
import { removeDuplicateDocuments } from "@/lib/duplicates";

const STORAGE_KEY = "mechsweep-documents";
const DB_NAME = "mechsweep";
const DB_VERSION = 1;
const STORE_NAME = "documents";
const DOCS_RECORD_KEY = "all";

function normalizeDocuments(docs: MechDocument[]): MechDocument[] {
  return removeDuplicateDocuments(
    docs.filter((doc) => !(doc.source === "sweep" && doc.status === "error" && !doc.content))
  );
}

function loadFromLocalStorage(): MechDocument[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MechDocument[];
    if (!Array.isArray(parsed)) return [];
    return normalizeDocuments(parsed);
  } catch {
    return [];
  }
}

function saveToLocalStorage(docs: MechDocument[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDocuments(docs)));
  } catch {
    // Quota exceeded; IndexedDB remains the primary store when available.
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function readFromIndexedDb(db: IDBDatabase): Promise<MechDocument[] | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(DOCS_RECORD_KEY);
    request.onsuccess = () => {
      const value = request.result;
      resolve(Array.isArray(value) ? normalizeDocuments(value as MechDocument[]) : null);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
}

function writeToIndexedDb(db: IDBDatabase, docs: MechDocument[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(normalizeDocuments(docs), DOCS_RECORD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}

export async function loadDocuments(): Promise<MechDocument[]> {
  if (typeof window === "undefined") return [];

  try {
    const db = await openDatabase();
    const indexedDocs = await readFromIndexedDb(db);
    db.close();
    if (indexedDocs) return indexedDocs;

    const localDocs = loadFromLocalStorage();
    if (localDocs.length > 0) await saveDocuments(localDocs);
    return localDocs;
  } catch {
    return loadFromLocalStorage();
  }
}

export async function saveDocuments(docs: MechDocument[]): Promise<void> {
  if (typeof window === "undefined") return;
  const normalized = normalizeDocuments(docs);

  try {
    const db = await openDatabase();
    await writeToIndexedDb(db, normalized);
    db.close();
  } catch {
    saveToLocalStorage(normalized);
  }
}
