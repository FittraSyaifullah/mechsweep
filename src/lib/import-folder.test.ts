import { describe, expect, it } from "vitest";
import { exportToTxt } from "@/lib/exporter";
import {
  parseExportedDocumentTxt,
  titleFromImportPath,
} from "@/lib/import-folder";
import type { ExportOptions, MechDocument } from "@/types";

const options: ExportOptions = {
  format: "txt",
  preset: "plain",
  chunkSize: 1000,
  chunkOverlap: 150,
  includeMetadata: true,
  includeContent: true,
  includeSummaries: true,
  includeTags: true,
};

const doc: MechDocument = {
  id: "doc-1",
  title: "Pump curves",
  type: "txt",
  source: "upload",
  content: "Flow and head data",
  summary: "Pump curve reference",
  tags: ["pump", "flow"],
  category: "Fluid Mechanics",
  addedAt: "2026-01-01T00:00:00.000Z",
  status: "ready",
};

describe("import-folder", () => {
  it("parses exported document txt back into metadata and content", () => {
    const exported = exportToTxt([doc], options);
    const parsed = parseExportedDocumentTxt(exported);

    expect(parsed).toMatchObject({
      id: "doc-1",
      title: "Pump curves",
      type: "txt",
      source: "upload",
      category: "Fluid Mechanics",
      content: "Flow and head data",
      summary: "Pump curve reference",
      tags: ["pump", "flow"],
    });
  });

  it("derives a readable title from export paths", () => {
    expect(titleFromImportPath("documents/001-pump-curves.txt")).toBe("pump curves");
    expect(titleFromImportPath("documents/10000-large-set.txt")).toBe("large set");
  });
});
