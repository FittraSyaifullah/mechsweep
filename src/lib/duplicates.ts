import type { MechDocument } from "@/types";

export function normalizeDocumentUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, "") || null;
  }
}

export async function hashContent(content: string): Promise<string> {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function findDuplicateDocument(
  documents: MechDocument[],
  candidate: Pick<MechDocument, "url" | "contentHash">
): MechDocument | null {
  const candidateUrl = normalizeDocumentUrl(candidate.url);
  if (candidateUrl) {
    const match = documents.find((doc) => normalizeDocumentUrl(doc.url) === candidateUrl);
    if (match) return match;
  }

  if (candidate.contentHash) {
    const match = documents.find((doc) => doc.contentHash === candidate.contentHash);
    if (match) return match;
  }

  return null;
}

export function removeDuplicateDocuments(documents: MechDocument[]): MechDocument[] {
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  return documents.filter((doc) => {
    const url = normalizeDocumentUrl(doc.url);
    if (url) {
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
    }

    if (doc.contentHash) {
      if (seenHashes.has(doc.contentHash)) return false;
      seenHashes.add(doc.contentHash);
    }

    return true;
  });
}
