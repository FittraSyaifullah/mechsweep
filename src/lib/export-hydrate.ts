import { applyDocumentBlob, readDocumentBlob } from "@/lib/document-blobs";
import type { MechDocument } from "@/types";

/** Load OPFS blob content when metadata-only records are exported. */
export async function hydrateDocumentForExport(doc: MechDocument): Promise<MechDocument> {
  if (doc.blobStored && !doc.content) {
    const blob = await readDocumentBlob(doc.id);
    if (blob) return applyDocumentBlob(doc, blob);
  }
  return doc;
}
