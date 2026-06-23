import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import {
  clearDocuments,
  deleteDocuments,
  loadDocuments,
  saveDocuments,
  upsertDocument,
} from "@/lib/storage";
import type { MechDocument } from "@/types";

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
  vi.stubGlobal("window", globalThis);
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

  it("trims saves to the library capacity limit", async () => {
    const docs = Array.from({ length: MAX_LIBRARY_DOCUMENTS + 5 }, (_, index) =>
      doc({ id: `doc-${index}`, contentHash: `hash-${index}` })
    );

    await saveDocuments(docs);
    expect((await loadDocuments()).length).toBe(MAX_LIBRARY_DOCUMENTS);
  });
});

describe("storage (IndexedDB)", () => {
  beforeEach(() => {
    setupBrowserGlobals();
    vi.stubGlobal("indexedDB", new IDBFactory());
  });

  it("persists documents in IndexedDB", async () => {
    await saveDocuments([
      doc({ id: "1", title: "Pump manual" }),
      doc({ id: "2", title: "Valve spec" }),
    ]);

    const loaded = await loadDocuments();
    expect(loaded.map((item) => item.id).sort()).toEqual(["1", "2"]);
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
  });

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
