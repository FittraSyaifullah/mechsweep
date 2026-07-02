import { describe, expect, it } from "vitest";
import {
  isSupabaseSchemaMissingError,
  mergeCloudLibraries,
} from "@/lib/supabase/sync";
import type { MechDocument } from "@/types";

function doc(partial: Partial<MechDocument> & Pick<MechDocument, "id" | "title">): MechDocument {
  return {
    type: "txt",
    source: "upload",
    content: "content",
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
    ...partial,
  };
}

describe("mergeCloudLibraries", () => {
  it("prefers ready documents over processing for the same id", () => {
    const local = [doc({ id: "a", title: "Local", status: "processing", content: "short" })];
    const remote = [doc({ id: "a", title: "Remote", status: "ready", content: "longer text" })];
    const merged = mergeCloudLibraries(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("ready");
    expect(merged[0].content).toBe("longer text");
  });

  it("keeps unique documents from both libraries", () => {
    const local = [doc({ id: "a", title: "A" })];
    const remote = [doc({ id: "b", title: "B" })];
    const merged = mergeCloudLibraries(local, remote);
    expect(merged.map((item) => item.id).sort()).toEqual(["a", "b"]);
  });

  it("respects library capacity", () => {
    const local = Array.from({ length: 30_000 }, (_, index) =>
      doc({ id: `local-${index}`, title: `Local ${index}` })
    );
    const remote = [doc({ id: "remote", title: "Remote" })];
    const merged = mergeCloudLibraries(local, remote);
    expect(merged.length).toBeLessThanOrEqual(25_000);
  });

  it("detects missing schema errors", () => {
    expect(
      isSupabaseSchemaMissingError(new Error("Could not find the table 'public.library_documents'"))
    ).toBe(true);
    expect(isSupabaseSchemaMissingError(new Error("network failed"))).toBe(false);
  });
});
