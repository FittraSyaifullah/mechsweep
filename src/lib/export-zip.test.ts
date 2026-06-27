import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportOptions, MechDocument } from "@/types";
import {
  exportDocumentsToZip,
  exportDocumentsToZipBuffer,
  isStreamingZipSupported,
} from "@/lib/export-zip";
import { MemoryZipTarget, ZipStreamWriter } from "@/lib/zip-writer";

vi.mock("@/lib/export-hydrate", () => ({
  hydrateDocumentForExport: vi.fn(async (doc: MechDocument) => doc),
}));

const options: ExportOptions = {
  format: "zip",
  preset: "plain",
  chunkSize: 1000,
  chunkOverlap: 150,
  includeMetadata: true,
  includeContent: true,
  includeSummaries: true,
  includeTags: true,
};

const docs: MechDocument[] = [
  {
    id: "doc-1",
    title: "Pump curves",
    type: "txt",
    source: "upload",
    content: "Flow and head data",
    summary: "Pump curve reference",
    tags: ["pump"],
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "ready",
  },
  {
    id: "doc-2",
    title: "Valve spec",
    type: "txt",
    source: "upload",
    content: "Pressure ratings",
    addedAt: "2026-01-02T00:00:00.000Z",
    status: "ready",
  },
];

describe("export-zip", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects streaming zip support from showSaveFilePicker", () => {
    vi.stubGlobal("window", { isSecureContext: true, showSaveFilePicker: vi.fn() });
    expect(isStreamingZipSupported()).toBe(true);
  });

  it("builds a valid zip buffer with streamed chunks file", async () => {
    const buffer = await exportDocumentsToZipBuffer(docs, options);
    const zip = new Uint8Array(buffer);
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Array.from(zip.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it("streams zip to a save file handle", async () => {
    const written: Uint8Array[] = [];
    const mockHandle = {
      name: "mechsweep-test.zip",
      createWritable: async () => ({
        write: async (part: Uint8Array) => {
          written.push(part);
        },
        close: async () => {},
        abort: async () => {},
      }),
    };

    vi.stubGlobal("window", {
      isSecureContext: true,
      showSaveFilePicker: vi.fn(async () => mockHandle),
    });

    const result = await exportDocumentsToZip(docs, options);
    expect(result.documentCount).toBe(2);
    expect(result.fileCount).toBe(5);
    expect(written.length).toBeGreaterThan(0);
  });
});

describe("zip-writer", () => {
  it("writes stored and streaming entries", async () => {
    const target = new MemoryZipTarget();
    const writer = new ZipStreamWriter(target);

    await writer.addStoredEntry("hello.txt", "hello");
    const stream = await writer.openStreamingEntry("lines.jsonl");
    await stream.writeText('{"a":1}\n');
    await stream.writeText('{"b":2}\n');
    await stream.close();
    await writer.finalize();

    const zip = new Uint8Array(target.toArrayBuffer());
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
