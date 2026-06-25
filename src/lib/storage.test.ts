import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentBlobPayload } from "@/lib/document-blobs";
import { resetOpfsProbeForTests, setDocumentBlobStoreForTests } from "@/lib/document-blobs";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import {
  clearDocuments,
  deleteDocuments,
  loadDocuments,
  saveDocuments,
  upsertDocument,
} from "@/lib/storage";
import type { MechDocument } from "@/types";

function createMemoryBlobStore() {
  const files = new Map<string, DocumentBlobPayload>();

  return {
    write: async (id: string, payload: DocumentBlobPayload) => {
      files.set(id, payload);
    },
    read: async (id: string) => files.get(id) ?? null,
    delete: async (id: string) => {
      files.delete(id);
    },
    deleteExcept: async (keepIds: Set<string>) => {
      for (const id of files.keys()) {
        if (!keepIds.has(id)) files.delete(id);
      }
    },
    clear: async () => {
      files.clear();
    },
    files,
  };
}

function doc(overrides: Partial<MechDocument>): MechDocument {
  return {
    id: "id",
    title: "Doc",
    type: "txt",
    source: "upload",
    content: "content",
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
    ...overrides,
  };
}

function setupBrowserGlobals() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", { ...globalThis, isSecureContext: true });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  return store;
}

describe("storage (localStorage fallback)", () => {
  beforeEach(() => {
    setupBrowserGlobals();
    vi.stubGlobal("indexedDB", undefined);
    setDocumentBlobStoreForTests(null);
    resetOpfsProbeForTests();
  });

  it("loads an empty array when storage is invalid", async () => {
    const store = setupBrowserGlobals();
    store.set("mechsweep-documents", "{bad");
    await expect(loadDocuments()).resolves.toEqual([]);
  });

  it("filters empty failed sweep docs and removes duplicates", async () => {
    const store = setupBrowserGlobals();
    store.set(
      "mechsweep-documents",
      JSON.stringify([
        doc({ id: "1", url: "https://example.com/a", contentHash: "a" }),
        doc({ id: "2", url: "https://example.com/a/", contentHash: "b" }),
        doc({ id: "3", source: "sweep", status: "error", content: "" }),
      ])
    );

    expect((await loadDocuments()).map((item) => item.id)).toEqual(["1"]);
  });

  it("saves de-duplicated documents through fallback storage", async () => {
    await saveDocuments([
      doc({ id: "1", contentHash: "same" }),
      doc({ id: "2", contentHash: "same" }),
    ]);

    expect((await loadDocuments()).map((item) => item.id)).toEqual(["1"]);
  });
});

describe("storage (IndexedDB)", () => {
  let blobStore = createMemoryBlobStore();

  beforeEach(() => {
    blobStore = createMemoryBlobStore();
    setupBrowserGlobals();
    vi.stubGlobal("indexedDB", new IDBFactory());
    setDocumentBlobStoreForTests(blobStore);
    resetOpfsProbeForTests();
  });

  it("persists documents in IndexedDB", async () => {
    await saveDocuments([
      doc({ id: "1", title: "Pump manual" }),
      doc({ id: "2", title: "Valve spec" }),
    ]);

    const loaded = await loadDocuments();
    expect(loaded.map((item) => item.id).sort()).toEqual(["1", "2"]);
  });

  it("stores heavy fields in OPFS and metadata in IndexedDB", async () => {
    const heavy = "x".repeat(5000);
    await saveDocuments([
      doc({
        id: "heavy-1",
        content: heavy,
        pages: [{ pageNumber: 1, text: "Page one" }],
        embedding: [0.1, 0.2],
      }),
    ]);

    expect(blobStore.files.get("heavy-1")?.content).toBe(heavy);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mechsweep", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<MechDocument>((resolve, reject) => {
      const tx = db.transaction("library", "readonly");
      const request = tx.objectStore("library").get("heavy-1");
      request.onsuccess = () => resolve(request.result as MechDocument);
      request.onerror = () => reject(request.error);
    });
    db.close();

    expect(record.blobStored).toBe(true);
    expect(record.content).toBe("");
    expect(record.contentLength).toBe(5000);
    expect(record.embedding).toBeUndefined();

    const loaded = await loadDocuments();
    expect(loaded[0]?.content).toBe(heavy);
    expect(loaded[0]?.pages?.[0]?.text).toBe("Page one");
  });

  it("keeps content inline in IndexedDB when OPFS writes fail", async () => {
    const failingStore = {
      ...createMemoryBlobStore(),
      write: async () => {
        throw new Error("OPFS unavailable");
      },
    };
    setDocumentBlobStoreForTests(failingStore);

    const content = "inline fallback content";
    await saveDocuments([doc({ id: "inline-1", content })]);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mechsweep", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<MechDocument>((resolve, reject) => {
      const tx = db.transaction("library", "readonly");
      const request = tx.objectStore("library").get("inline-1");
      request.onsuccess = () => resolve(request.result as MechDocument);
      request.onerror = () => reject(request.error);
    });
    db.close();

    expect(record.blobStored).toBeUndefined();
    expect(record.content).toBe(content);

    const loaded = await loadDocuments();
    expect(loaded[0]?.content).toBe(content);
  });

  it("upserts a single document without rewriting the full library", async () => {
    await saveDocuments([doc({ id: "1", content: "v1" })]);
    await upsertDocument(doc({ id: "1", content: "v2", title: "Updated" }));

    const loaded = await loadDocuments();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.content).toBe("v2");
    expect(loaded[0]?.title).toBe("Updated");
  });

  it("deletes documents by id", async () => {
    await saveDocuments([
      doc({ id: "1" }),
      doc({ id: "2" }),
      doc({ id: "3" }),
    ]);
    await deleteDocuments(["1", "3"]);

    expect((await loadDocuments()).map((item) => item.id)).toEqual(["2"]);
  });

  it("clears the library", async () => {
    await saveDocuments([doc({ id: "1" }), doc({ id: "2" })]);
    await clearDocuments();
    expect(await loadDocuments()).toEqual([]);
    expect(blobStore.files.size).toBe(0);
  });

  it(
    "trims saves to the library capacity limit",
    async () => {
      const docs = Array.from({ length: MAX_LIBRARY_DOCUMENTS + 5 }, (_, index) =>
        doc({ id: `doc-${index}`, content: "", contentHash: `hash-${index}` })
      );

      await saveDocuments(docs);
      expect((await loadDocuments()).length).toBe(MAX_LIBRARY_DOCUMENTS);
    },
    15000
  );

  it("migrates localStorage backup into IndexedDB on first load", async () => {
    const store = setupBrowserGlobals();
    store.set(
      "mechsweep-documents",
      JSON.stringify([doc({ id: "legacy-1", title: "From localStorage" })])
    );

    const loaded = await loadDocuments();
    expect(loaded.map((item) => item.id)).toEqual(["legacy-1"]);

    store.clear();
    expect((await loadDocuments()).map((item) => item.id)).toEqual(["legacy-1"]);
  });
});
