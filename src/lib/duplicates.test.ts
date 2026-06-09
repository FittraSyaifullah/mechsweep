import { describe, expect, it } from "vitest";
import {
  dedupeSweepResultsByUrl,
  findDuplicateDocument,
  hashContent,
  normalizeDocumentUrl,
  removeDuplicateDocuments,
} from "@/lib/duplicates";
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

describe("duplicate helpers", () => {
  it("normalizes URLs for duplicate checks", () => {
    expect(normalizeDocumentUrl("https://example.com/a/?b=2&a=1#top")).toBe(
      "https://example.com/a/?a=1&b=2"
    );
  });

  it("hashes equivalent whitespace consistently", async () => {
    await expect(hashContent("pump\n curve")).resolves.toBe(await hashContent("pump curve"));
  });

  it("finds and removes duplicates by URL or hash", () => {
    const docs = [
      doc({ id: "1", url: "https://example.com/report.pdf", contentHash: "a" }),
      doc({ id: "2", url: "https://example.com/report.pdf/", contentHash: "b" }),
      doc({ id: "3", contentHash: "a" }),
    ];

    expect(findDuplicateDocument(docs, { url: "https://example.com/report.pdf/" })?.id).toBe(
      "1"
    );
    expect(removeDuplicateDocuments(docs).map((item) => item.id)).toEqual(["1"]);
  });

  it("dedupes sweep results with normalized URLs", () => {
    const merged = dedupeSweepResultsByUrl([
      { url: "https://a.test/1", title: "A", type: "pdf", description: "", relevanceScore: 1 },
      { url: "https://a.test/1/", title: "A copy", type: "pdf", description: "", relevanceScore: 1 },
    ]);
    expect(merged).toHaveLength(1);
  });
});
