import { beforeEach, describe, expect, it } from "vitest";
import type { DocumentBlobPayload } from "@/lib/document-blobs";
import {
  applyDocumentBlob,
  documentHasBlobPayload,
  extractDocumentBlob,
  hydrateDocumentsFromBlobs,
  setDocumentBlobStoreForTests,
  writeDocumentBlob,
} from "@/lib/document-blobs";
import type { MechDocument } from "@/types";

function doc(overrides: Partial<MechDocument> = {}): MechDocument {
  return {
    id: "doc-1",
    title: "Manual",
    type: "txt",
    source: "upload",
    content: "Pump curves and efficiency data",
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
    ...overrides,
  };
}

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

describe("document-blobs", () => {
  beforeEach(() => {
    setDocumentBlobStoreForTests(null);
  });

  it("detects blob payloads", () => {
    expect(documentHasBlobPayload(doc())).toBe(true);
    expect(documentHasBlobPayload(doc({ content: "" }))).toBe(false);
    expect(documentHasBlobPayload(doc({ content: "", embedding: [0.1, 0.2] }))).toBe(true);
  });

  it("round-trips blob payloads through the memory store", async () => {
    const store = createMemoryBlobStore();
    setDocumentBlobStoreForTests(store);

    const source = doc({
      pages: [{ pageNumber: 1, text: "Page one" }],
      embedding: [0.5, 0.25],
    });

    await writeDocumentBlob(source.id, extractDocumentBlob(source));
    const hydrated = applyDocumentBlob(
      { ...source, content: "", blobStored: true, contentLength: source.content.length },
      await store.read(source.id)
    );

    expect(hydrated.content).toBe(source.content);
    expect(hydrated.pages).toEqual(source.pages);
    expect(hydrated.embedding).toEqual(source.embedding);
  });

  it("hydrates blob-backed documents", async () => {
    const store = createMemoryBlobStore();
    setDocumentBlobStoreForTests(store);
    await writeDocumentBlob("doc-1", extractDocumentBlob(doc()));

    const [hydrated] = await hydrateDocumentsFromBlobs([
      {
        ...doc({ content: "", blobStored: true, contentLength: 31 }),
      },
    ]);

    expect(hydrated?.content).toContain("Pump curves");
  });
});
