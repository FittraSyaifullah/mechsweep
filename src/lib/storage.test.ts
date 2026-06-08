import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDocuments, saveDocuments } from "@/lib/storage";
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

describe("storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {});
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
  });

  it("loads an empty array when storage is invalid", async () => {
    store.set("mechsweep-documents", "{bad");
    await expect(loadDocuments()).resolves.toEqual([]);
  });

  it("filters empty failed sweep docs and removes duplicates", async () => {
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
