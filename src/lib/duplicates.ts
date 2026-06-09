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

export function buildNormalizedUrlSet(
  urls: Iterable<string | undefined | null>
): Set<string> {
  const set = new Set<string>();
  for (const url of Array.from(urls)) {
    const normalized = normalizeDocumentUrl(url ?? undefined);
    if (normalized) set.add(normalized);
  }
  return set;
}

export function isDocumentUrlKnown(url: string, knownUrls: Set<string>): boolean {
  const normalized = normalizeDocumentUrl(url);
  if (normalized) return knownUrls.has(normalized);
  return knownUrls.has(url.trim());
}

export function findDuplicateDocument(
  documents: MechDocument[],
  candidate: { url?: string; contentHash?: string; title?: string }
): MechDocument | null {
  const candidateUrl = normalizeDocumentUrl(candidate.url);
  if (candidateUrl) {
    const match = documents.find(
      (doc) => normalizeDocumentUrl(doc.url) === candidateUrl
    );
    if (match) return match;
  }

  if (candidate.contentHash) {
    const match = documents.find((doc) => doc.contentHash === candidate.contentHash);
    if (match) return match;
  }

  const normalizedTitle = candidate.title?.trim().toLowerCase();
  if (normalizedTitle && normalizedTitle.length >= 4) {
    const titleMatch = documents.find(
      (doc) => doc.title.trim().toLowerCase() === normalizedTitle
    );
    if (titleMatch) return titleMatch;
  }

  return null;
}

export function removeDuplicateDocuments(documents: MechDocument[]): MechDocument[] {
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const seenTitles = new Set<string>();

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

    const titleKey = doc.title.trim().toLowerCase();
    if (titleKey.length >= 4 && !url && !doc.contentHash) {
      if (seenTitles.has(titleKey)) return false;
      seenTitles.add(titleKey);
    }

    return true;
  });
}

export function dedupeSweepResultsByUrl<T extends { url: string }>(results: T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const result of results) {
    const key = normalizeDocumentUrl(result.url) ?? result.url.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(result);
  }

  return merged;
}
