import {
  DEFAULT_SWEEP_MAX_RESULTS,
  SWEEP_BATCH_SIZE,
} from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import { sweepBatchCount } from "@/lib/sweep-limits";
import type { SweepResult } from "@/types";

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

export async function fetchSweepBatch(
  query: string,
  excludeUrls: string[],
  batchSize: number
): Promise<SweepBatchResponse & { ok: boolean; status: number }> {
  const { response, data } = await fetchJson<SweepBatchResponse>("/api/sweep", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query || undefined,
      excludeUrls,
      maxResults: batchSize,
    }),
  });

  return {
    ok: response.ok,
    status: response.status,
    ...data,
    results: data.results ?? [],
  };
}

export async function runBatchedSweep(options: BatchedSweepOptions): Promise<BatchedSweepResult> {
  const {
    query,
    excludeUrls,
    totalTarget = DEFAULT_SWEEP_MAX_RESULTS,
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

    const batchExclude = [
      ...excludeUrls,
      ...merged.map((result) => result.url),
    ];

    const batch = await fetchSweepBatch(query, batchExclude, batchSize);
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
