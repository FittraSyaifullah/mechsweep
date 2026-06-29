import { yieldToMain, createThrottledProgress, flushThrottledProgress } from "@/lib/scheduling";
import { hydrateDocumentForExport } from "@/lib/export-hydrate";
import {
  buildDocumentExportPath,
  buildExportChunksForDocument,
  buildExportManifest,
  buildFolderCorpusIndex,
  exportToTxt,
} from "@/lib/exporter";
import type { ExportOptions, MechDocument } from "@/types";

export interface StreamExportProgress {
  phase: "preparing" | "documents" | "metadata";
  completed: number;
  total: number;
  skipped?: number;
}

export interface StreamExportWriteHandlers {
  writeDocumentFile: (relativePath: string, content: string) => Promise<void>;
  openChunkStream: (relativePath: string) => Promise<(line: string) => Promise<void>>;
  closeChunkStream: () => Promise<void>;
  writeMetadataFile: (relativePath: string, content: string) => Promise<void>;
}

function compactJson(value: unknown, documentCount: number): string {
  return documentCount > 500 ? JSON.stringify(value) : JSON.stringify(value, null, 2);
}

/** Shared streaming export loop — one document at a time with UI yields. */
export async function streamExportDocuments(
  documents: MechDocument[],
  options: ExportOptions,
  handlers: StreamExportWriteHandlers,
  onProgress?: (progress: StreamExportProgress) => void
): Promise<{ exportPaths: string[]; chunkCount: number }> {
  const report = createThrottledProgress(onProgress);
  const exportPaths: string[] = [];
  let chunkCount = 0;
  let skipped = 0;

  report({ phase: "preparing", completed: 0, total: documents.length, skipped: 0 });
  await yieldToMain();

  const chunksPath = `${options.preset}-chunks.jsonl`;
  const writeChunkLine = await handlers.openChunkStream(chunksPath);

  for (let index = 0; index < documents.length; index++) {
    const source = documents[index]!;
    let hydrated: MechDocument;
    try {
      hydrated = await hydrateDocumentForExport(source);
    } catch {
      skipped += 1;
      hydrated = { ...source, content: source.content || "", blobStored: undefined };
    }

    const exportPath = buildDocumentExportPath(index, documents.length, hydrated.title);
    exportPaths.push(exportPath);

    await handlers.writeDocumentFile(exportPath, exportToTxt([hydrated], options));

    for (const chunk of buildExportChunksForDocument(hydrated, options)) {
      await writeChunkLine(`${JSON.stringify(chunk)}\n`);
      chunkCount += 1;
    }

    report({
      phase: "documents",
      completed: index + 1,
      total: documents.length,
      skipped,
    });

    await yieldToMain();
  }

  flushThrottledProgress(report, {
    phase: "documents",
    completed: documents.length,
    total: documents.length,
    skipped,
  });

  await handlers.closeChunkStream();
  await yieldToMain();

  report({ phase: "metadata", completed: 0, total: 2 });

  const manifest = buildExportManifest(documents, options, chunkCount);
  await handlers.writeMetadataFile("manifest.json", compactJson(manifest, documents.length));
  report({ phase: "metadata", completed: 1, total: 2 });
  await yieldToMain();

  const corpus = buildFolderCorpusIndex(documents, options, exportPaths, chunkCount);
  await handlers.writeMetadataFile("corpus.json", compactJson(corpus, documents.length));
  flushThrottledProgress(report, { phase: "metadata", completed: 2, total: 2 });

  return { exportPaths, chunkCount };
}
