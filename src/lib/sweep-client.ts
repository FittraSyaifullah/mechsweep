import { fetchJson, ApiResponseError } from "@/lib/fetch-json";
import { buildCompactSweepPayload } from "@/lib/sweep-payload";
import { SWEEP_BATCH_SIZE, SWEEP_MAX_EXCLUDE_URLS } from "@/lib/constants";
import { resolveSweepSessionMax, sweepBatchCount } from "@/lib/sweep-limits";
import type { SweepResult } from "@/types";

/** @deprecated Use buildCompactSweepPayload — kept for tests. */
export function buildSweepExcludeUrls(
  libraryUrls: string[],
  sweepUrls: string[],
  max = SWEEP_MAX_EXCLUDE_URLS
): string[] {
  return buildCompactSweepPayload({
    libraryUrls,
    sweepUrls,
    maxResults: 1,
  }).excludeUrls.slice(0, max);
}

export interface SweepBatchResponse {
  results: SweepResult[];
  provider?: string;
  error?: string;
  maxResults?: number;
}

export interface BatchedSweepOptions {
  query: string;
  excludeUrls: string[];
  /** Total unique results to collect (full sweep). Ignored when singleBatch is true. */
  totalTarget?: number;
  batchSize?: number;
  /** When true, fetch only one batch (Sweep more). */
  singleBatch?: boolean;
  existingResults?: SweepResult[];
  onProgress?: (batchIndex: number, batchTotal: number) => void;
}

export interface BatchedSweepResult {
  results: SweepResult[];
  provider: string | null;
  batchesCompleted: number;
}

export function mergeSweepResults(
  existing: SweepResult[],
  incoming: SweepResult[]
): SweepResult[] {
  const seen = new Set(existing.map((result) => result.url));
  const merged = [...existing];

  for (const result of incoming) {
    if (!seen.has(result.url)) {
      merged.push(result);
      seen.add(result.url);
    }
  }

  return merged;
}

const CLIENT_SWEEP_TIMEOUT_MS = 120_000;

export async function fetchSweepBatch(
  query: string,
  libraryUrls: string[],
  sweepUrls: string[],
  batchSize: number
): Promise<SweepBatchResponse & { ok: boolean; status: number }> {
  const payload = buildCompactSweepPayload({
    query,
    libraryUrls,
    sweepUrls,
    maxResults: batchSize,
  });

  try {
    const { response, data } = await fetchJson<SweepBatchResponse>("/api/sweep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CLIENT_SWEEP_TIMEOUT_MS),
    });

    return {
      ok: response.ok,
      status: response.status,
      ...data,
      results: data.results ?? [],
    };
  } catch (error) {
    if (error instanceof ApiResponseError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("Sweep request timed out waiting for the server. Retry or use a narrower query.");
    }
    throw error;
  }
}

export async function runBatchedSweep(options: BatchedSweepOptions): Promise<BatchedSweepResult> {
  const {
    query,
    excludeUrls,
    totalTarget = resolveSweepSessionMax(),
    batchSize = SWEEP_BATCH_SIZE,
    singleBatch = false,
    existingResults = [],
    onProgress,
  } = options;

  const batchTotal = sweepBatchCount(totalTarget, batchSize, singleBatch);
  let merged = [...existingResults];
  let provider: string | null = null;
  let batchesCompleted = 0;

  for (let batchIndex = 0; batchIndex < batchTotal; batchIndex++) {
    onProgress?.(batchIndex + 1, batchTotal);

    const batch = await fetchSweepBatch(
      query,
      excludeUrls,
      merged.map((result) => result.url),
      batchSize
    );
    if (!batch.ok) {
      throw new Error(batch.error ?? "Sweep failed");
    }

    provider = batch.provider ?? provider;
    const beforeCount = merged.length;
    merged = mergeSweepResults(merged, batch.results);
    batchesCompleted += 1;

    if (batch.results.length === 0) break;
    if (merged.length >= totalTarget) break;
    if (!singleBatch && merged.length === beforeCount) break;
    if (batch.results.length < batchSize) break;
  }

  if (!singleBatch && totalTarget > 0) {
    merged = merged.slice(0, totalTarget);
  }

  return { results: merged, provider, batchesCompleted };
}
