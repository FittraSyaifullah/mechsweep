import { describe, expect, it } from "vitest";
import { mergeDocumentLibraries } from "@/lib/library-merge";
import type { MechDocument } from "@/types";

function doc(overrides: Partial<MechDocument>): MechDocument {
  return {
    id: "1",
    title: "Doc",
    type: "txt",
    source: "upload",
    content: "content",
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
    ...overrides,
  };
}

describe("mergeDocumentLibraries", () => {
  it("keeps unique documents from both libraries", () => {
    const merged = mergeDocumentLibraries(
      [doc({ id: "a" })],
      [doc({ id: "b", title: "Remote" })]
    );
    expect(merged.map((item) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("prefers ready documents over processing for the same id", () => {
    const merged = mergeDocumentLibraries(
      [doc({ id: "a", status: "processing", content: "draft" })],
      [doc({ id: "a", status: "ready", content: "final", addedAt: "2026-01-02T00:00:00.000Z" })]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe("ready");
    expect(merged[0]?.content).toBe("final");
  });
});
