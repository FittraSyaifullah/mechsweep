import type { MechDocument } from "@/types";

/** Embeddings are regenerated locally; omit them from cloud payloads. */
export function prepareDocForCloud(doc: MechDocument): MechDocument {
  const { embedding: _embedding, ...rest } = doc;
  return rest;
}
