import { MAX_LIBRARY_DOCUMENTS } from "@/lib/constants";
import { removeDuplicateDocuments } from "@/lib/duplicates";
import type { MechDocument } from "@/types";

const STATUS_RANK: Record<MechDocument["status"], number> = {
  ready: 4,
  processing: 3,
  pending: 2,
  error: 1,
};

function pickPreferredDocument(a: MechDocument, b: MechDocument): MechDocument {
  const rankA = STATUS_RANK[a.status];
  const rankB = STATUS_RANK[b.status];
  if (rankA !== rankB) return rankA > rankB ? a : b;

  const contentA = a.content?.length ?? 0;
  const contentB = b.content?.length ?? 0;
  if (contentA !== contentB) return contentA > contentB ? a : b;

  return a.addedAt >= b.addedAt ? a : b;
}

export function mergeDocumentLibraries(
  local: MechDocument[],
  remote: MechDocument[]
): MechDocument[] {
  const merged = new Map<string, MechDocument>();

  for (const doc of local) merged.set(doc.id, doc);
  for (const doc of remote) {
    const existing = merged.get(doc.id);
    merged.set(doc.id, existing ? pickPreferredDocument(existing, doc) : doc);
  }

  const normalized = removeDuplicateDocuments(Array.from(merged.values()));
  if (normalized.length <= MAX_LIBRARY_DOCUMENTS) return normalized;
  return normalized.slice(0, MAX_LIBRARY_DOCUMENTS);
}
